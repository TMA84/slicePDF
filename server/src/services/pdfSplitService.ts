import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { SplitResult } from '../types.js';

/**
 * Calculate split info for a given total page count and pages per document.
 */
export function calculateSplitInfo(
  totalPages: number,
  pagesPerDoc: number
): { numDocuments: number; lastDocPages: number } {
  const numDocuments = Math.ceil(totalPages / pagesPerDoc);
  const remainder = totalPages % pagesPerDoc;
  const lastDocPages = remainder === 0 ? pagesPerDoc : remainder;
  return { numDocuments, lastDocPages };
}

/**
 * Split a source PDF into multiple documents, each containing `pagesPerDoc` pages.
 * The last document may contain fewer pages if totalPages is not evenly divisible.
 */
export async function splitPdf(
  sourcePath: string,
  pagesPerDoc: number,
  outputDir: string,
  onProgress?: (progress: number) => void
): Promise<SplitResult[]> {
  const sourceBytes = await readFile(sourcePath);
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const totalPages = sourcePdf.getPageCount();

  const { numDocuments } = calculateSplitInfo(totalPages, pagesPerDoc);

  await mkdir(outputDir, { recursive: true });

  const results: SplitResult[] = [];

  for (let i = 0; i < numDocuments; i++) {
    const startPage = i * pagesPerDoc;
    const endPage = Math.min(startPage + pagesPerDoc, totalPages);
    const pageCount = endPage - startPage;

    const newPdf = await PDFDocument.create();
    const pageIndices = Array.from({ length: pageCount }, (_, k) => startPage + k);
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
    for (const page of copiedPages) {
      newPdf.addPage(page);
    }

    const fileName = `doc-${String(i).padStart(3, '0')}.pdf`;
    const filePath = join(outputDir, fileName);
    const pdfBytes = await newPdf.save();
    await writeFile(filePath, pdfBytes);

    results.push({
      index: i,
      filePath,
      pageRange: { start: startPage, end: endPage - 1 },
      pageCount,
    });

    if (onProgress) {
      const progress = Math.round(((i + 1) / numDocuments) * 100);
      onProgress(progress);
    }
  }

  return results;
}
