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

export async function extractPDFPages(file: Blob): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      pages.push(textContent.items.map(item => 'str' in item ? item.str : '').join(' '));
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

export async function validatePDFExport(file: Blob, expectedText: string) {
  return validateExportText(expectedText, await extractPDFPages(file));
}
