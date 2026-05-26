import express from "express";
import path from "path";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";
import cors from "cors";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid';
import { google } from "googleapis";
import stream from "stream";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as Optimization from "./server/optimization.ts";
import { renderResumeToHTML } from "./server/resumeTemplate.ts";
import { pipelineCache } from "./server/cacheUtility";
import { calculateCost, UsageLog } from "./server/analytics";
import { runAgents } from "./server/agents";
import { generatePerRole } from "./server/roleGenerator";
import { deduplicateAndScore } from "./server/dedup";
import { saveResumeVersion } from "./server/memory";
// import { scrapeJobs } from "./server/jobScraper";

dotenv.config();

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const app = admin.apps.length 
  ? admin.apps[0] 
  : admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });

// Robust Firestore initialization: fallback to default database if specific ID fails or is not provided
let db: admin.firestore.Firestore;
try {
  const dbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "") 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined;
  db = getFirestore(app, dbId);
} catch (e) {
  console.warn("[Server] Failed to initialize Firestore with specified database ID, falling back to default.");
  db = getFirestore(app);
}

// Helper to get API keys from Firestore securely
async function getApiKeys(idToken: string) {
    if (idToken === "SYSTEM_PIPELINE") return null;
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const doc = await db.collection("users").doc(uid).get();
      
      if (!doc.exists) {
        return null; // Return null instead of throwing
      }
      
      let data = doc.data();
      
      // FALLBACK: If current user has no key, check for a "shared" key in 'users/admin'
      if (!data || !data.encryptedApiKey) {
        console.log(`[Server] User ${uid} has no key. Checking for fallback in 'users/admin'...`);
        const adminDoc = await db.collection("users").doc("admin").get();
        if (adminDoc.exists) {
          data = adminDoc.data();
          console.log(`[Server] Found fallback key in 'users/admin'.`);
        }
      }

      if (!data || !data.encryptedApiKey) {
        return null; // Return null instead of throwing
      }

      // Decrypt the keys before returning
      try {
        const decrypted = decrypt(data.encryptedApiKey);
        try {
          return JSON.parse(decrypted);
        } catch (e) {
          // Fallback for older single-key format
          return { gemini: decrypted };
        }
      } catch (error: any) {
        if (error.message.includes("DECRYPTION_FAILED")) {
          console.warn(`[Server] Decryption failed for user ${uid}. Treating as no key found.`);
          return null;
        }
        throw error;
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
      throw new Error("UNAUTHORIZED_OR_MISSING_KEYS");
    }
}

// Function to log usage to Firestore
async function logUsage(log: UsageLog) {
  try {
    await db.collection("analytics").add({
      ...log,
      timestamp: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging usage to Firestore:", error);
  }
}

// PDF Sessions storage
const pdfSessions = new Map<string, { html: string, css: string, fonts: string, title?: string, timestamp: number }>();

// Cleanup old sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of pdfSessions.entries()) {
    if (now - session.timestamp > 1800000) { // 30 minutes
      pdfSessions.delete(id);
    }
  }
}, 600000);

// Encryption Setup
// We use a stable key derived from GEMINI_API_KEY if ENCRYPTION_KEY is not provided.
// This prevents "bad decrypt" errors after server restarts.
const getEncryptionKey = () => {
  const envKey = process.env.ENCRYPTION_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  
  if (envKey) {
    if (envKey.length === 64) {
      console.log("[Encryption] Using ENCRYPTION_KEY from environment.");
      return envKey;
    } else {
      console.warn("[Encryption] ENCRYPTION_KEY in environment is not 64 characters. Hashing it to ensure 32-byte key.");
      return crypto.createHash('sha256').update(envKey).digest('hex');
    }
  }
  
  if (geminiKey) {
    console.log("[Encryption] Deriving ENCRYPTION_KEY from GEMINI_API_KEY.");
    return crypto.createHash('sha256').update(geminiKey).digest('hex');
  }
  
  console.warn("[Encryption] No ENCRYPTION_KEY or GEMINI_API_KEY found. Using static fallback key. WARNING: Your encrypted data will be lost if you provide an API key later.");
  return "4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b"; 
};

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  try {
    const textParts = text.split(':');
    if (textParts.length < 2) throw new Error("Invalid encrypted text format");
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error: any) {
    console.error("Decryption Error:", error);
    if (error.message.includes('bad decrypt') || error.code === 'ERR_OSSL_EVP_BAD_DECRYPT') {
      throw new Error("DECRYPTION_FAILED: The encryption key has changed or the data is corrupted. Please re-save your API keys in your profile.");
    }
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Debug: Log all incoming requests
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health-check", (req, res) => {
    res.json({ status: "alive", timestamp: new Date().toISOString() });
  });

  app.get("/api/generate-resume-pdf", async (req, res) => {
    try {
      const html = renderResumeToHTML();
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(html);
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      res.contentType("application/pdf");
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
      res.send(pdf);
    } catch (error) {
      console.error(error);
      res.status(500).send("Failed to generate PDF");
    }
  });

  console.log("Environment Variables Check:");
  console.log("PUPPETEER_EXECUTABLE_PATH:", process.env.PUPPETEER_EXECUTABLE_PATH);
  console.log("HTTP_PROXY:", process.env.HTTP_PROXY);

  // Google Drive Client Setup
  const getDriveClient = (accessToken?: string) => {
    // Ensure accessToken is a valid string and not "null", "undefined", or empty
    const isValidToken = accessToken && 
                        typeof accessToken === 'string' && 
                        accessToken !== 'null' && 
                        accessToken !== 'undefined' && 
                        accessToken.trim() !== '';

    if (isValidToken) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      return google.drive({ version: 'v3', auth });
    }

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const folderId = process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;

    if (!serviceAccountKey) {
      console.warn("GOOGLE_SERVICE_ACCOUNT_KEY is not set. Drive fallback to Service Account will be unavailable.");
      return null;
    }

    if (folderId && (folderId.startsWith('{') || folderId.includes('service_account'))) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_FOLDER_ID appears to contain a Service Account JSON instead of a Folder ID. Please check your environment variables.");
    }
    
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (e) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not a valid JSON string. Ensure it is the full content of your service account key file.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
  };

  app.post("/api/save-to-drive", async (req, res) => {
    const { pdfData, fileName, versioningEnabled, accessToken, parentFolderId } = req.body;
    
    if (!pdfData || !fileName) {
      return res.status(400).json({ error: "PDF data and file name are required" });
    }

    // Escape single quotes in file name for Drive query
    const escapedFileName = fileName.replace(/'/g, "\\'");

    try {
      const drive = getDriveClient(accessToken);
      const folderId = parentFolderId || process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;
      
      // Determine mimeType from fileName
      const mimeType = fileName.endsWith('.csv') ? 'text/csv' : 'application/pdf';

      // Convert base64 to stream
      const buffer = Buffer.from(pdfData, 'base64');
      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);

      let fileId = null;
      
      if (!versioningEnabled) {
        // Search for existing file with same name
        const query = folderId 
          ? `name = '${escapedFileName}' and '${folderId}' in parents and trashed = false`
          : `name = '${escapedFileName}' and trashed = false`;

        const response = await drive.files.list({
          q: query,
          fields: 'files(id, name)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        
        if (response.data.files && response.data.files.length > 0) {
          fileId = response.data.files[0].id;
        }
      }

      if (fileId) {
        // Update existing file
        await drive.files.update({
          fileId: fileId,
          media: {
            mimeType: mimeType,
            body: bufferStream,
          },
          supportsAllDrives: true,
        });
        res.json({ success: true, message: "File updated successfully", fileId });
      } else {
        // Create new file
        const finalFileName = versioningEnabled 
          ? `${fileName.replace(/\.(pdf|csv)$/, '')} (v${new Date().toISOString().replace(/[:.]/g, '-')})${fileName.endsWith('.csv') ? '.csv' : '.pdf'}`
          : fileName;

        const fileMetadata: any = {
          name: finalFileName,
          mimeType: mimeType,
        };

        if (folderId) {
          fileMetadata.parents = [folderId];
        }
        
        const media = {
          mimeType: mimeType,
          body: bufferStream,
        };

        const file = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id',
          supportsAllDrives: true,
        });
        res.json({ success: true, message: "File created successfully", fileId: file.data.id });
      }
    } catch (error: any) {
      console.error("Drive Save Error:", error.message || error);
      let errorData = null;
      if (error.response && error.response.data) {
        errorData = error.response.data;
        console.error("Drive Save Error Details:", JSON.stringify(errorData));
      }
      
      let errorMessage = "Failed to save to Google Drive";
      let statusCode = error.response?.status || 500;
      
      if (statusCode === 401) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      } else if (statusCode === 403 && errorData?.error?.message?.includes("storage quota")) {
        errorMessage = "STORAGE_QUOTA_EXCEEDED: Service Account has no storage quota on personal drives. Please set your parent folder to a folder inside a 'Shared Drive' (created in Google Drive).";
      } else if (error.code === 404) {
        errorMessage = "Folder or File not found. Please verify your folder ID and permissions.";
      } else if (error.message && error.message.includes("invalid_grant")) {
        errorMessage = "Authentication failed. Please check your Service Account configuration.";
      } else {
        errorMessage = error.message || errorMessage;
      }

      res.status(statusCode).json({ error: errorMessage });
    }
  });

  app.get("/api/list-drive-folders", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      if (!drive) {
        return res.status(401).json({ error: "Google Drive is not connected. Please connect via OAuth in settings." });
      }
      const response = await drive.files.list({
        // List folders that are not trashed
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        pageSize: 1000,
        fields: 'files(id, name, modifiedTime)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      res.json({ 
        success: true, 
        folders: response.data.files || [] 
      });
    } catch (error: any) {
      console.error("Drive Folder List Error:", error.message || error);
      
      let errorMessage = error.message || "Failed to fetch Drive folders";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }

      res.status(error.response?.status || 500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  app.get("/api/list-drive-files", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      if (!drive) {
        return res.status(401).json({ error: "Google Drive is not connected. Please connect via OAuth in settings." });
      }
      const folderId = process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;
      
      const query = folderId 
        ? `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`
        : "mimeType = 'application/pdf' and trashed = false";

      const response = await drive.files.list({
        q: query,
        pageSize: 50,
        fields: 'files(id, name, webViewLink, modifiedTime)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      res.json({ 
        success: true, 
        files: response.data.files || [] 
      });
    } catch (error: any) {
      console.error("Drive List Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive List Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to fetch Drive files";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }

      res.status(error.response?.status || 500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  app.patch("/api/rename-drive-file", express.json(), async (req, res) => {
    const { fileId, newName, accessToken } = req.body;
    if (!fileId || !newName) {
      return res.status(400).json({ error: "Missing fileId or newName" });
    }
    try {
      const drive = getDriveClient(accessToken);
      await drive.files.update({
        fileId: fileId,
        requestBody: {
          name: newName.endsWith('.pdf') ? newName : `${newName}.pdf`
        },
        supportsAllDrives: true,
      });
      res.json({ success: true, message: "File renamed successfully" });
    } catch (error: any) {
      console.error("Drive Rename Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive Rename Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to rename file";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }
      
      res.status(error.response?.status || 500).json({ error: errorMessage });
    }
  });

  app.delete("/api/delete-drive-file", express.json(), async (req, res) => {
    const { fileId, accessToken } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: "Missing fileId" });
    }
    try {
      const drive = getDriveClient(accessToken);
      await drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true,
      });
      res.json({ success: true, message: "File deleted successfully" });
    } catch (error: any) {
      console.error("Drive Delete Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive Delete Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to delete file";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }
      
      res.status(error.response?.status || 500).json({ error: errorMessage });
    }
  });

  app.get("/api/test-drive", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      const response = await drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      res.json({ 
        success: true, 
        message: accessToken 
          ? "Connection successful! Authenticated via Google OAuth." 
          : "Connection successful! Drive API is enabled and Service Account is authenticated.",
        filesFound: response.data.files?.length || 0
      });
    } catch (error: any) {
      console.error("Drive Test Error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to connect to Google Drive",
        details: accessToken 
          ? "Ensure your Google account has Drive API permissions and the token is valid."
          : "Ensure GOOGLE_SERVICE_ACCOUNT_KEY is correct and Drive API is enabled in Google Cloud Console."
      });
    }
  });

  // API Endpoint to encrypt API Key
  app.post("/api/encrypt-key", (req, res) => {
    const { apiKey, existingEncryptedKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "API key is required" });
    }
    try {
      let keysToEncrypt = apiKey;
      
      // If we're passing a JSON string of keys and an existing encrypted key, merge them
      if (existingEncryptedKey) {
        try {
          const newKeys = JSON.parse(apiKey);
          const decryptedExisting = decrypt(existingEncryptedKey);
          let existingKeys: any = {};
          try {
            existingKeys = JSON.parse(decryptedExisting);
          } catch (e) {
            // If the existing key wasn't JSON, assume it was a Gemini key for backwards compatibility
            existingKeys = { gemini: decryptedExisting };
          }
          
          // Merge keys, keeping existing ones if the new one is empty
          const mergedKeys = {
            gemini: newKeys.gemini || existingKeys.gemini || '',
            openai: newKeys.openai || existingKeys.openai || ''
          };
          keysToEncrypt = JSON.stringify(mergedKeys);
        } catch (e) {
          // Ignore decryption errors, assume existing keys are invalid/inaccessible
        }
      }

      const encryptedKey = encrypt(keysToEncrypt);
      res.json({ encryptedKey });
    } catch (error: any) {
      console.error("Encryption Error:", error);
      res.status(500).json({ error: "Failed to encrypt API key" });
    }
  });

  // API Endpoint to decrypt API keys for frontend use
  app.post("/api/decrypt-keys", (req, res) => {
    const { encryptedKey } = req.body;
    if (!encryptedKey) {
      return res.status(400).json({ error: "Encrypted key is required" });
    }
    try {
      const decryptedString = decrypt(encryptedKey);
      let keys: any = {};
      try {
        keys = JSON.parse(decryptedString);
      } catch (e) {
        // For backwards compatibility if it was a single raw key
        keys = { gemini: decryptedString };
      }
      res.json({ keys });
    } catch (error: any) {
      console.error("Decryption Error:", error);
      res.status(500).json({ error: "Failed to decrypt API keys" });
    }
  });

  // API Endpoint to clear cache
  app.post("/api/cache/clear", (req, res) => {
    Optimization.clearCache();
    res.json({ success: true, message: "Cache cleared successfully" });
  });

  // Admin Analytics Endpoints
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp?.toDate?.()?.getTime() || data.timestamp || Date.now()
        } as UsageLog;
      });

      const totalRequests = logs.filter(l => l.endpoint === "/api/v2/optimize").length;
      const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
      const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);
      const cacheHits = logs.filter(l => l.cacheHit).length;
      const cacheHitRatio = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

      res.json({
        totalRequests,
        totalTokens,
        totalCost,
        cacheHitRatio
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/usage-by-day", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp?.toDate?.()?.getTime() || data.timestamp || Date.now()
        } as UsageLog;
      });

      const dailyData: Record<string, { tokens: number, cost: number }> = {};
      
      logs.forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { tokens: 0, cost: 0 };
        }
        dailyData[date].tokens += log.totalTokens;
        dailyData[date].cost += log.cost;
      });

      const result = Object.entries(dailyData).map(([date, data]) => ({
        date,
        ...data
      })).sort((a, b) => a.date.localeCompare(b.date));

      res.json(result);
    } catch (error) {
      console.error("Error fetching usage by day:", error);
      res.status(500).json({ error: "Failed to fetch usage by day" });
    }
  });

  app.get("/api/admin/model-usage", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => doc.data() as UsageLog);

      const modelData: Record<string, number> = {};
      
      logs.forEach(log => {
        const model = log.cacheHit ? "Cache" : log.model;
        modelData[model] = (modelData[model] || 0) + 1;
      });

      const result = Object.entries(modelData).map(([name, value]) => ({
        name,
        value
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching model usage:", error);
      res.status(500).json({ error: "Failed to fetch model usage" });
    }
  });

  app.post("/api/v2/optimize", async (req, res) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const idToken = authHeader.split('Bearer ')[1];

    const { 
      resumeText, 
      jobDescription, 
      targetRole, 
      mode, 
      audience, 
      customPrompt, 
      pipelineType,
      targetCompany,
      brainDump 
    } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // 1. Fetch keys securely from Firestore
      const keys = await getApiKeys(idToken);
      let geminiKey = process.env.GEMINI_API_KEY;
      let openaiKey = "";
      
      if (keys) {
        geminiKey = keys.gemini || geminiKey;
        openaiKey = keys.openai || "";
      } else {
        console.warn("User has no API key configured. Using system key.");
      }
      
      if (!geminiKey) console.warn("Gemini API key not found. Expecting platform-provided authentication to be available.");
      
      const selectedPipeline = pipelineType || 'hybrid-gemini';

      const config: any = {};
      if (geminiKey) config.apiKey = geminiKey;
      
      // Need to find where Gemini is instantiated to update it
      // Let's first verify where it's initialized and how it's used before changing too much.

      // 2. Check Cache First (Key includes all relevant fields)
      const cacheKey = pipelineCache.generateKey({ 
        resumeText: resumeText,
        jobDescription: jobDescription,
        targetRole, 
        mode, 
        audience, 
        customPrompt,
        pipelineType: selectedPipeline
      });
      
      const cachedResult = pipelineCache.get(cacheKey);
      if (cachedResult) {
        // Log cache hit
        logUsage({
          userId: "anonymous",
          model: "cache",
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cacheHit: true,
          endpoint: "/api/v2/optimize",
          timestamp: Date.now(),
          cost: 0
        });
        return res.json(cachedResult);
      }

      if (selectedPipeline === 'hybrid-openai' && !openaiKey) {
        throw new Error("OpenAI API Key is required for Hybrid OpenAI mode.");
      }

      // STEP 1: Gemini (Cheap) - Extraction & Analysis
      console.log(`[Pipeline] Step 1: Gemini Extraction (${geminiKey ? 'User Key' : 'System Key'})...`);
      const [resumeExtraction, jdExtraction] = await Promise.all([
        Optimization.extractRelevantResumeData(resumeText, geminiKey, openaiKey, selectedPipeline),
        Optimization.extractJDKeywords(jobDescription, geminiKey, openaiKey, selectedPipeline)
      ]);

      const resumeData = resumeExtraction?.data;
      const jdKeywords = jdExtraction?.data || [];
      const extractionModelUsed = (resumeExtraction as any)?._model || "gemini-3-flash-preview";
      
      const geminiUsage = {
        promptTokenCount: (resumeExtraction?.usage?.promptTokenCount || 0) + (jdExtraction?.usage?.promptTokenCount || 0),
        candidatesTokenCount: (resumeExtraction?.usage?.candidatesTokenCount || 0) + (jdExtraction?.usage?.candidatesTokenCount || 0),
        totalTokenCount: (resumeExtraction?.usage?.totalTokenCount || 0) + (jdExtraction?.usage?.totalTokenCount || 0)
      };

      if (!resumeData) throw new Error("Failed to extract resume data using Gemini.");

      // STEP 2: Internal Logic (Free) - Trimming
      console.log("[Pipeline] Step 2: Trimming Content...");
      const optimizedInput = Optimization.trimContentForAI(resumeData, jdKeywords);
      
      console.log("=== OPTIMIZED INPUT EXPERIENCE ===");
      console.dir(optimizedInput.experience, { depth: null });

      // STEP 3: Gemini 3.1 Pro (Premium) - Final Generation
      const finalPrompt = `
        You are a senior executive resume strategist. 
        Optimize this structured resume data for the target role: ${targetRole}.
        Audience: ${audience}. Mode: ${mode}.
        ${customPrompt ? `Custom Instructions: ${customPrompt}` : ''}
        ${brainDump ? `ADDITIONAL CONTEXT (BRAIN DUMP): ${brainDump}\nSift through this raw data and include high-impact achievements that are missing from the original resume.` : ''}
        
        CORPORATE DNA TAILORING:
        ${targetCompany === 'amazon' ? 'TAILOR FOR AMAZON: Emphasize "Ownership", "Bias for Action", and "Data-driven results". Use terminology from Amazon Leadership Principles.' : ''}
        ${targetCompany === 'microsoft' ? 'TAILOR FOR MICROSOFT: Emphasize "Enterprise Scale", "Cloud Transformation", and "Collaborative Ecosystems".' : ''}
        ${targetCompany === 'google' ? 'TAILOR FOR GOOGLE: Emphasize "Systems Design", "Extreme Scale", "Algorithmic Efficiency", and "Google XYZ Formula".' : ''}
        ${targetCompany === 'meta' ? 'TAILOR FOR META: Emphasize "Moving Fast", "Shipping End-to-End Impact", and "Performance Optimization".' : ''}
        ${targetCompany === 'accenture' || targetCompany === 'infosys' ? 'TAILOR FOR CONSULTING: Emphasize "Client Delivery", "Global Managed Services", and "Cross-functional Deployment".' : 'TAILOR FOR PRODUCT TECH: Focus on internal product growth and feature ownership.'}
        
        PLAYER-COACH MODE:
        ${mode === 'Player-Coach' ? `
          - 60/40 BALANCE: 60% Execution (Azure infra, Site Recovery, Entra ID), 40% Leadership (Mentoring, Agile pods, Architecture reviews).
          - HYBRID VOCABULARY: Use "Architected & Led," "Designed & Mentored," "Engineered & Standardized," "Spearheaded."
          - STRICT NEGATIVE CONSTRAINTS: ABSOLUTELY FORBIDDEN: "CI/CD", "Pipelines", "DevOps". Focus entirely on Azure Infrastructure.
        ` : ''}

        INPUT DATA (Optimized):
        ${JSON.stringify(optimizedInput, null, 2)}
        
        STRICT RULES:
        1. TONE & FOCUS: Maintain a professional, concise, executive-level tone suitable for FAANG, Senior Cloud Architect, or Director-level infrastructure roles. Focus heavily on these JD keywords: ${optimizedInput.jd_keywords.join(', ')}.
        
        2. PRESERVE TITLES: Do NOT modify job titles under any circumstances. Specifically, NEVER change "Officer IT cum Logistics" to "Office IT cum Logistics". This is a mandatory requirement.
        
        3. INCLUDE ALL ROLES: You MUST include every single role provided in the INPUT DATA. Do not skip any jobs, even very old ones.
        
        4. NO HALLUCINATIONS: DO NOT invent, suggest, or add any certifications, skills, metrics, or experience that are not explicitly present in the INPUT DATA. Do not "suggest" certifications if the user doesn't have them.
        
        5. BREVITY & DENSITY: Bullet points MUST be dense and achievement-oriented (recommended length: 15-20 words). Prioritize hard skills, tools, and scale metrics over verbose filler jargon.
        
        6. RECENT ROLE EXPANSION (Post-2018) - ABSOLUTE REQUIREMENT: You MUST output EXACTLY 4 to 5 bullet points for EVERY single role that occurred after 2018. DO NOT merge, combine, or consolidate the original bullets, even if the role was only a few months long. If the input has 5 bullets for a recent role, you must rewrite and output exactly 4 or 5 bullets. No exceptions.
        
        7. OLDER ROLE COMPRESSION (Pre-2018): Provide EXACTLY one (1) bullet point maximum for roles and projects that occurred before 2018. Focus on foundational infrastructure experience.
        
        8. SOURCE ANCHORING (CRITICAL): Each experience entry contains ORIGINAL BULLETS. You MUST derive new bullets ONLY from that specific role’s original content. Do NOT borrow, reuse, or "hallucinate" content from other roles to fill gaps.
        
        9. BALANCED IaC: Terraform/IaC references are permitted but limited to 2 bullet points TOTAL across the entire resume.
        
        10. VERB CONTROL: Avoid forbidden buzzwords like "Spearheaded", "Visionary", "Dynamic", or "Guru". For execution bullets, use allowed verbs: "Deployed", "Maintained", "Utilized", "Provisioned".
        
        11. ANTI-DUPLICATION: Avoid semantic repetition across roles. Each role should demonstrate distinct business or technical impact. Do not repeat identical achievement phrasing.
        
        12. DEVOPS BAN: The terms "CI/CD", "Pipelines", and "DevOps" are ABSOLUTELY FORBIDDEN. Focus the narrative entirely on Azure Infrastructure, HA/DR, and Governance.
        
        
        OUTPUT SCHEMA (MUST MATCH EXACTLY):
        {
          "personal_info": { "name": "string", "location": "string", "email": "string", "phone": "string", "linkedin": "string", "linkedinText": "string" },
          "summary": "string",
          "skills": { "Category 1": ["string"], "Category 2": ["string"], "Category 3": ["string"], "Category 4": ["string"] },
          "experience": [ { "id": "string", "role": "string", "company": "string", "duration": "string", "bullets": ["string"] } ],
          "projects": [ { "title": "string", "description": "string" } ],
          "education": ["string"],
          "certifications": [
            { "name": "string", "issuer": "string", "date": "string" }
          ],
          "ats_keywords_from_jd": ["string"],
          "ats_keywords_added_to_resume": ["string"],
          "keyword_gap": ["string"],
          "match_score": 85,
          "baseline_score": 60,
          "improvement_notes": ["string"],
          "audience_alignment_notes": "string",
          "why_this_job": "string",
          "rejection_reasons": ["string"],
          "star_stories": [
            { "bullet": "string", "situation": "string", "task": "string", "action": "string", "result": "string" }
          ],
          "audit_report": {
            "score": 85,
            "flags": [
              { "id": "string", "type": "string", "message": "string", "fix": "string", "severity": "high" }
            ],
            "trajectory": {
              "stage": "acceleration",
              "description": "string",
              "recommendation": "string"
            }
          }
        }
      `;

      let result;
      let usedModel = pipelineType === 'hybrid-openai' ? "gpt-4o" : "gemini-3.1-pro-preview";

      if (pipelineType === 'hybrid-openai') {
        // OPENAI BRANCH
        try {
          console.log(`[Hybrid Pipeline] Step 3: Premium OpenAI Generation (${usedModel})...`);
          const openai = new OpenAI({ apiKey: openaiKey });
          const chatCompletion = await openai.chat.completions.create({
            model: usedModel,
            messages: [{ 
              role: "system", 
              content: "You are a senior executive resume strategist. Output strictly JSON." 
            }, { 
              role: "user", 
              content: finalPrompt
            }],
            response_format: { type: "json_object" }
          });

          const responseText = chatCompletion.choices[0].message.content || "";
          const genInput = chatCompletion.usage?.prompt_tokens || 0;
          const genOutput = chatCompletion.usage?.completion_tokens || 0;

          logUsage({
            userId: "anonymous",
            model: usedModel,
            inputTokens: genInput,
            outputTokens: genOutput,
            totalTokens: genInput + genOutput,
            cacheHit: false,
            endpoint: "/api/v2/optimize",
            timestamp: Date.now(),
            cost: calculateCost(usedModel, genInput, genOutput)
          });

          // Log Gemini Extraction
          logUsage({
            userId: "anonymous",
            model: extractionModelUsed,
            inputTokens: geminiUsage.promptTokenCount,
            outputTokens: geminiUsage.candidatesTokenCount,
            totalTokens: geminiUsage.totalTokenCount,
            cacheHit: false,
            endpoint: "/api/v2/optimize",
            timestamp: Date.now(),
            cost: calculateCost(extractionModelUsed, geminiUsage.promptTokenCount, geminiUsage.candidatesTokenCount)
          });

          result = {
            result: responseText,
            usage: {
              promptTokenCount: genInput,
              candidatesTokenCount: genOutput,
              totalTokenCount: genInput + genOutput
            },
            geminiUsage,
            intermediateData: { resumeData, jdKeywords },
            _engine: 'hybrid-openai',
            _model: usedModel
          };
        } catch (openaiError: any) {
          console.warn("[Pipeline] OpenAI Premium Failed, falling back to Gemini Flash...", openaiError.message);
          // CRITICAL FALLBACK: If OpenAI (Premium) fails, use the cheap Gemini we have
          const fallbackModelName = "gemini-3-flash-preview";
          const genAI = new GoogleGenAI({ apiKey: geminiKey });
          
          const fallbackResult = await genAI.models.generateContent({
            model: fallbackModelName,
            contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
            config: { responseMimeType: "application/json" }
          });
          
          const text = fallbackResult.text || "";
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("Both OpenAI and Fallback Gemini failed.");

          result = {
            result: jsonMatch[0],
            usage: {
              promptTokenCount: fallbackResult.usageMetadata?.promptTokenCount || 0,
              candidatesTokenCount: fallbackResult.usageMetadata?.candidatesTokenCount || 0,
              totalTokenCount: fallbackResult.usageMetadata?.totalTokenCount || 0
            },
            geminiUsage,
            intermediateData: { resumeData, jdKeywords },
            _model: fallbackModelName,
            _fallback: true
          };
        }
      } else {
        // GEMINI BRANCH
        try {
        console.log(`[Pipeline] Step 3: Split Generation (Gemini ${usedModel})...`);
        const genAI = new GoogleGenAI({ apiKey: geminiKey });
        
        // 1. Generate Meta Data (Summary, Skills, Why This Job, etc.)
        const metaPrompt = `
          You are a senior executive resume strategist.
          Optimize the meta-sections of this resume for: ${targetRole}.
          Audience: ${audience}. Mode: ${mode}.
          Keywords: ${optimizedInput.jd_keywords.join(', ')}.
          ${brainDump ? `ADDITIONAL CONTEXT (BRAIN DUMP): ${brainDump}` : ''}
          
          INPUT DATA:
          ${JSON.stringify({
            personal_info: optimizedInput.personal_info,
            summary: optimizedInput.summary,
            skills: optimizedInput.skills,
            projects: optimizedInput.projects,
            education: optimizedInput.education,
            certifications: optimizedInput.certifications,
            jd_keywords: optimizedInput.jd_keywords
          }, null, 2)}
          
          RULES:
          - Summary: Approx 100 words.
          - Skills: Categorize into exactly 4 logical categories relevant to ${targetRole}. Rename 'DevOps & Automation' to 'Infrastructure Operations & Automation'. Strictly replace 'CI/CD Pipeline Design' with 'Infrastructure Provisioning'.
          - Why This Job: 100-150 words compelling response.
          - DO NOT invent certifications.
          - Brevity & Density: Bullet points MUST be concise and dense (max 15 words). Prioritize hard skills, tools, and metrics over verbose jargon.
          - Balanced IaC: Terraform/IaC permitted, limited to 2 bullet points TOTAL across entire resume. Forbidden verbs: "Architected", "Engineered", "Spearheaded". Allowed: "Deployed", "Maintained", "Utilized", "Provisioned".
          - Pre-2018 Compression: Before 2018, provide EXACTLY one (1) bullet point maximum for projects.
          - GLOBAL NEGATIVE CONSTRAINTS: ABSOLUTELY FORBIDDEN: "CI/CD", "Pipelines", "DevOps". These terms MUST NOT appear anywhere in the output, including project summaries, skill categories, or bullet points. Focus project summaries entirely on Azure Migration, FinOps, HA/DR, and Governance.
          
          OUTPUT JSON SCHEMA:
          {
            "personal_info": { ... },
            "summary": "...",
            "skills": { "Category 1": ["skill1", ...], ... },
            "why_this_job": "...",
            "projects": [...],
            "education": [...],
            "certifications": [...],
            "ats_keywords_from_jd": [...],
            "ats_keywords_added_to_resume": [...],
            "keyword_gap": [...],
            "match_score": 85,
            "improvement_notes": [...],
            "audience_alignment_notes": "...",
            "star_stories": [
              { "bullet": "The highly optimized bullet", "situation": "...", "task": "...", "action": "...", "result": "..." }
            ],
            "audit_report": {
              "score": 85,
              "flags": [
                { "id": "f1", "type": "...", "message": "...", "fix": "...", "severity": "high" }
              ],
              "trajectory": {
                "stage": "acceleration",
                "description": "...",
                "recommendation": "..."
              }
            }
          }
        `;

        // 2. Generate Roles Individually (Parallel) and Deduplicate
        console.log(`[Pipeline] Spawning meta generation and ${optimizedInput.experience.length} role generation tasks...`);
        const [metaResponse, roleResults] = await Promise.all([
          genAI.models.generateContent({
            model: usedModel,
            contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
            config: { responseMimeType: "application/json" }
          }),
          generatePerRole(
            optimizedInput.experience, 
            geminiKey, 
            targetCompany, 
            targetRole,
            audience,
            mode,
            customPrompt,
            brainDump
          )
        ]);

        const metaText = metaResponse.text || "{}";
        const metaData = JSON.parse(metaText);
        
        // 3. Deduplicate and Score
        console.log("[Pipeline] Deduplicating and Scoring...");
        const finalExperience = deduplicateAndScore(roleResults);

        const finalResult = {
          ...metaData,
          experience: finalExperience
        };

        // STEP 4: Agentic Review (Multi-Agent Refinement)
        console.log("[Pipeline] Step 4: Multi-Agent Review...");
        const agentFeedback = await runAgents(finalResult, geminiKey);

        result = {
          result: JSON.stringify(finalResult),
          agentFeedback,
          usage: {
            promptTokenCount: metaResponse.usageMetadata?.promptTokenCount || 0,
            candidatesTokenCount: metaResponse.usageMetadata?.candidatesTokenCount || 0,
            totalTokenCount: metaResponse.usageMetadata?.totalTokenCount || 0
          },
          geminiUsage,
          intermediateData: { resumeData, jdKeywords },
          _model: usedModel,
          _optimized: true,
          _split_gen: true,
          _agents: true
        };

        console.log("[Pipeline] Split Generation Complete.");

      } catch (genError: any) {
        console.error("[Pipeline] Split Generation Failed:", genError);
        // Fallback to simpler single call if split gen fails
        res.status(500).json({ error: "Failed to optimize resume via split pipeline", details: genError.message });
        return;
      }
    }
    
    // STEP 5: Cache Result (Merged/Unified)
    if (result) {
      Optimization.saveToCache(cacheKey, result);
      res.json(result);
    }
    } catch (error: any) {
      console.error("V2 Optimization Error:", error);
      res.status(500).json({ error: "Failed to optimize resume via V2 pipeline", details: error.message });
    }
  });
  
  app.post("/api/v3/optimize", async (req, res) => {
    try {
      const authHeader = req.header('Authorization');
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
  
      const idToken = authHeader.split('Bearer ')[1];
  
      const { 
        resumeText, 
        jobDescription,
        targetRole,
        targetCompany,
        mode,
        audience,
        customPrompt,
        brainDump
      } = req.body;
  
      if (!resumeText || !jobDescription) {
        return res.status(400).json({ error: "Missing input" });
      }
  
      // ===============================
      // 1. GET KEYS
      // ===============================
      const keys = await getApiKeys(idToken);
      let geminiKey = process.env.GEMINI_API_KEY;
      if (keys && keys.gemini) {
        geminiKey = keys.gemini;
      } else {
        console.warn("User has no API key configured. Using system key.");
      }
  
      // ===============================
      // 2. EXTRACTION
      // ===============================
      const resumeExtraction = await Optimization.extractRelevantResumeData(resumeText, geminiKey);
      const jdExtraction = await Optimization.extractJDKeywords(jobDescription, geminiKey);
  
      const resumeData = resumeExtraction?.data;
      const jdKeywords = jdExtraction?.data || [];
  
      if (!resumeData) throw new Error("Extraction failed");
  
      // ===============================
      // 3. MULTI AGENT
      // ===============================
      const agentOutput = await runAgents({
        resume: resumeData,
        jd: jdKeywords
      }, geminiKey);
  
      // ===============================
      // 4. ROLE GENERATION (NO DUP)
      // ===============================
      const roles = await generatePerRole(
        agentOutput.hr.experience || resumeData.experience,
        geminiKey,
        targetCompany,
        targetRole,
        audience,
        mode,
        customPrompt,
        brainDump
      );
  
      // ===============================
      // 5. DEDUP + SCORE
      // ===============================
      const cleaned = deduplicateAndScore(roles);
  
      const totalScore = cleaned.reduce((sum, r: any) => sum + (r.score || 0), 0);
  
      // ===============================
      // 6. SAVE MEMORY
      // ===============================
      await saveResumeVersion(db, "anonymous", {
        input: resumeData,
        output: cleaned,
        score: totalScore
      });
  
      // ===============================
      // 7. RESPONSE
      // ===============================
      res.json({
        experience: cleaned,
        score: totalScore,
        _engine: "multi-agent-v3"
      });
  
    } catch (error: any) {
      console.error("V3 Error:", error);
      res.status(500).json({
        error: "Optimization failed",
        details: error.message
      });
    }
  });

  // API Endpoint for PDF Generation (Direct)
  app.post("/api/generate-pdf", async (req, res) => {
    const { html, css, fonts } = req.body;
    await handlePdfGeneration(html, css, fonts, res);
  });

  // API Endpoint to create a PDF session
  app.post("/api/pdf-session", (req, res) => {
    const { html, css, fonts, title } = req.body;
    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }
    const sessionId = uuidv4();
    pdfSessions.set(sessionId, { html, css, fonts, title, timestamp: Date.now() });
    res.json({ sessionId });
  });

  // API Endpoint to download PDF from session
  app.get("/api/download-pdf/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const session = pdfSessions.get(sessionId);
    if (!session) {
      return res.status(404).send("PDF session expired or not found. Please try generating again.");
    }
    // Optional: delete session after retrieval to save memory
    // pdfSessions.delete(sessionId);
    await handlePdfGeneration(session.html, session.css, session.fonts, res, session.title);
  });

  async function handlePdfGeneration(html: string, css: string, fonts: string, res: any, title: string = "Resume") {
    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    console.log(`Generating PDF. HTML length: ${html.length}`);
    console.log(`CSS length: ${css?.length || 0}`);
    console.log(`Fonts length: ${fonts?.length || 0}`);
    console.log(`CSS snippet: ${css?.substring(0, 500) || ''}`);

    let browser;
    try {
      // In this environment, we often need to force puppeteer to use the installed chrome
      // or let it find its own. Deleting the env var sometimes helps if it points to a wrong path.
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      
      browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--font-render-hinting=none",
        ],
      });

      const page = await browser.newPage();
      
      // Set viewport to A4 dimensions at 96 DPI
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

      // Construct a more robust base HTML
      const baseHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
              /* Reset and Base Styles */
              * { box-sizing: border-box; }
              @page { 
                size: A4; 
                margin: 0; /* No margins to allow fixed-height pages to fit */
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 210mm;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              /* Ensure the resume container takes full width */
              #resume-container, .resume-page {
                width: 100% !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
              }
              /* Inject User Styles */
              ${css || ''}
              ${fonts || ''}
                h1, h2, h3, h4 { margin-top: 6px !important; margin-bottom: 2px !important; }
                ul { margin-top: 2px !important; margin-bottom: 6px !important; padding-left: 20px !important; }
                li { margin-bottom: 2px !important; }
                .experience-item { margin-bottom: 8px !important; page-break-inside: avoid; }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      // Set content and wait for it to load
      await page.setContent(baseHtml, { 
        waitUntil: "networkidle2", // Wait until no more than 2 network connections
        timeout: 30000 
      });

      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready');

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        pageRanges: "1-2"
      });

      console.log(`PDF generated. Size: ${pdfBuffer.length} bytes`);

      if (pdfBuffer.length < 100) {
        throw new Error("Generated PDF is suspiciously small. It might be empty or corrupted.");
      }

      // Set headers and send
      res.setHeader("Content-Type", "application/pdf");
      const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.end(pdfBuffer);

    } catch (error: any) {
      console.error("CRITICAL PDF ERROR:", error);
      // If we haven't sent headers yet, send a JSON error
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to generate PDF", 
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error("Error closing puppeteer:", e);
        }
      }
    }
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});