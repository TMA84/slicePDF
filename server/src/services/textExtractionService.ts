import { readFile } from 'node:fs/promises';
import { getDocument, type TextItem } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Extract text content from a specific page of a PDF file.
 * @param pdfPath - Absolute or relative path to the PDF file on disk
 * @param pageIndex - 0-based page index
 * @returns The concatenated text content of the specified page
 */
export async function extractTextFromPage(
  pdfPath: string,
  pageIndex: number
): Promise<string> {
  const buffer = await readFile(pdfPath);
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const pdf = await getDocument({ data }).promise;

  try {
    // pdfjs-dist uses 1-based page numbers
    const page = await pdf.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();

    // Preserve line structure using hasEOL flags from pdfjs-dist
    const text = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map((item) => item.str + (item.hasEOL ? '\n' : ''))
      .join('');

    return text;
  } finally {
    await pdf.destroy();
  }
}
