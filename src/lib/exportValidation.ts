export interface ExportValidationReport {
  page_count: number;
  blocks_checked: number;
  errors: string[];
  warnings: string[];
}

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}@.+#%$£€₹-]/gu, "");
}

/** Checks the delivered file against the exact text selected for rendering. */
export function validateExportText(expectedText: string, pages: string[], pageLimit = 2): ExportValidationReport {
  const blocks = expectedText.split(/\r?\n/).map(text => text.trim()).filter(text => normalize(text).length > 0);
  const actual = normalize(pages.join("\n"));
  const report: ExportValidationReport = { page_count: pages.length, blocks_checked: blocks.length, errors: [], warnings: [] };
  if (!blocks.length) report.errors.push("The resume preview has no readable text to validate.");
  if (!actual) report.errors.push("The exported PDF has no extractable text.");
  let cursor = 0;
  for (const block of blocks) {
    const token = normalize(block);
    const position = actual.indexOf(token, cursor);
    if (position < 0) {
      report.errors.push(`${actual.includes(token) ? "Reading order or duplicate content mismatch" : "Missing or altered content"}: ${block.slice(0, 100)}`);
    } else {
      cursor = position + token.length;
    }
  }
  pages.forEach((text, index) => {
    if (!normalize(text)) report.errors.push(`Page ${index + 1} has no extractable text.`);
  });
  if (pages.length > pageLimit) report.warnings.push(`The PDF is ${pages.length} pages; the target is ${pageLimit}. Adjust layout or content if needed.`);
  return report;
}
