import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { validateExportText } from './exportValidation';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export async function extractTextFromPDFFile(file: File): Promise<string> {
  return (await extractPDFPages(file)).join('\n') + '\n';
}

async function inspectPDF(file: Blob): Promise<{ pages: string[]; warnings: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  try {
    const pages: string[] = [];
    const warnings: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      pages.push(textContent.items.map(item => 'str' in item ? item.str : '').join(' '));
      const viewport = page.getViewport({ scale: 1 });
      for (const item of textContent.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const sizePt = Math.hypot(item.transform[2], item.transform[3]);
        if (sizePt < 9.9 && !warnings.includes('Exported PDF contains text below the recommended 10 pt readability floor.')) {
          warnings.push('Exported PDF contains text below the recommended 10 pt readability floor.');
        }
        const [x, y] = [item.transform[4], item.transform[5]];
        if (x < -1 || y < -1 || x + item.width > viewport.width + 1 || y > viewport.height + 1) {
          const warning = `Page ${i} contains text outside the page bounds; review clipping.`;
          if (!warnings.includes(warning)) warnings.push(warning);
        }
      }
    }
    return { pages, warnings };
  } finally {
    await pdf.destroy();
  }
}

export async function extractPDFPages(file: Blob): Promise<string[]> {
  return (await inspectPDF(file)).pages;
}

export async function validatePDFExport(file: Blob, expectedText: string) {
  const inspection = await inspectPDF(file);
  const report = validateExportText(expectedText, inspection.pages);
  report.warnings.push(...inspection.warnings);
  return report;
}
