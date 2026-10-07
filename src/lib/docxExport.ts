import { Document, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import { exportBlocks } from "./atsDocument";
import type { AtsFont } from "./atsDocument";
import type { OptimizationResult } from "../services/geminiService";
import { validateExportText } from "./exportValidation";

export async function createResumeDOCX(resume: OptimizationResult, font: AtsFont = "Arial"): Promise<Blob> {
  const blocks = exportBlocks(resume);
  const document = new Document({
    creator: resume.personal_info.name,
    title: `${resume.personal_info.name} - Resume`,
    styles: { default: { document: { run: { font, size: 22, color: "000000" }, paragraph: { spacing: { line: 300, after: 120 } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 907, bottom: 907, left: 907, right: 907 } } },
      children: blocks.map(block => new Paragraph({
        children: [new TextRun({ text: block.text, font, size: block.kind === "name" ? 36 : block.kind === "heading" ? 24 : 22, bold: block.kind === "name" || block.kind === "heading" })],
        ...(block.kind === "bullet" ? { bullet: { level: 0 } } : {}),
        keepNext: block.kind === "heading" || block.kind === "name",
        spacing: { before: block.kind === "heading" ? 240 : 0, after: 120, line: 300 },
      })),
    }],
  });
  const blob = await Packer.toBlob(document);
  await validateResumeDOCX(blob, resume);
  return blob;
}

function decodeXML(text: string): string {
  return text.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export async function validateResumeDOCX(blob: Blob, resume: OptimizationResult): Promise<void> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("DOCX validation failed: document body is missing.");
  const xml = await file.async("string");
  if (/<w:(?:tbl|txbxContent)\b/.test(xml)) throw new Error("DOCX validation failed: tables or text boxes are not allowed in the safe export.");
  const paragraphs = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map(match =>
    [...match[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(text => decodeXML(text[1])).join("")
  );
  const report = validateExportText(exportBlocks(resume).map(block => block.text).join("\n"), [paragraphs.join("\n")]);
  if (report.errors.length) throw new Error(`DOCX validation failed: ${report.errors[0]}`);
}
