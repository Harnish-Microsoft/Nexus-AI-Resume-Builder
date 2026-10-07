import assert from "node:assert/strict";
import test from "node:test";
import puppeteer from "puppeteer";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AtsResumePreview } from "../src/components/AtsResumePreview";
import { ATS_FONTS, atsSafePDFStyle, exportBlocks } from "../src/lib/atsDocument";
import type { OptimizationResult } from "../src/services/geminiService";

test("real PDF fixture preserves canonical content, font sizes and long-resume pagination", { timeout: 120000 }, async () => {
  const vite = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  await vite.listen();
  const address = vite.httpServer!.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined),
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    let fixtureHTML = "";
    page.on("request", request => {
      if (request.url() === `${base}/__pdf-fixture`) void request.respond({ contentType: "text/html", body: fixtureHTML });
      else if (request.url().startsWith(`${base}/`) || /^(blob:|data:)/.test(request.url())) void request.continue();
      else void request.abort();
    });
    const resume: OptimizationResult = {
      personal_info: { name: "Taylor Example", email: "taylor@example.org", phone: "+44 20 7946 0958", location: "London", linkedin: "" },
      summary: "Cloud engineer with Azure infrastructure experience.",
      skills: { Infrastructure: ["Azure", "Bicep"], DevSecOps: [], Governance: [], Observability: [] },
      experience: [{ company: "Example Services Ltd", role: "Engineer", duration: "Jan 2022 - Present",
        bullets: Array.from({ length: 90 }, (_, index) => `Designed Azure landing zone ${index + 1} using Bicep and documented network governance decisions.`) }],
      education: ["BSc | Example University | 2019"], certifications: ["AZ-104"], projects: [],
      match_score: 0, baseline_score: 0, ats_keywords_from_jd: [], ats_keywords_added_to_resume: [], keyword_gap: [],
      improvement_notes: [], audience_alignment_notes: "",
    };
    const expected = exportBlocks(resume).map(block => block.text).join("\n");
    for (const font of ATS_FONTS) {
      fixtureHTML = `<html><head><style>${atsSafePDFStyle(font)}</style></head><body><div id="resume-container">${renderToStaticMarkup(createElement(AtsResumePreview, { resume, font }))}</div></body></html>`;
      await page.goto(`${base}/__pdf-fixture`);
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf({ format: "A4", scale: 1, preferCSSPageSize: true, displayHeaderFooter: false });
      const result = await page.evaluate(async (bytes, expectedText) => {
        const modulePath = "/src/lib/pdfUtils.ts";
        const { validatePDFExport } = await import(/* @vite-ignore */ modulePath);
        const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
        return {
          valid: await validatePDFExport(blob, expectedText),
          missing: await validatePDFExport(blob, `${expectedText}\nAn omitted source achievement`),
        };
      }, Array.from(pdf), expected);
      assert.deepEqual(result.valid.errors, [], font);
      assert.ok(result.valid.page_count > 2, "readability takes precedence over a forced two-page fit");
      assert.ok(!result.valid.warnings.some((warning: string) => warning.includes("10 pt")), font);
      assert.ok(result.missing.errors.length, "missing source content must fail");
    }
  } finally {
    await browser?.close();
    await vite.close();
  }
});
