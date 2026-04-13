import { describe } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { calculateSplitInfo } from '../pdfSplitService.js';

/**
 * Feature: pdf-serial-letter-splitter, Property 1: Aufteilungsberechnung
 *
 * Validates: Requirements 2.2, 2.4
 *
 * For all valid combinations of totalPages (> 0) and pagesPerDoc (> 0),
 * the calculated number of target documents shall equal Math.ceil(totalPages / pagesPerDoc),
 * and the last target document shall contain exactly (totalPages % pagesPerDoc || pagesPerDoc) pages.
 */
describe('Feature: pdf-serial-letter-splitter, Property 1: Aufteilungsberechnung', () => {
  const totalPagesArb = fc.integer({ min: 1, max: 10000 });
  const pagesPerDocArb = fc.integer({ min: 1, max: 1000 });

  test.prop([totalPagesArb, pagesPerDocArb], { numRuns: 100 })(
    'numDocuments equals Math.ceil(totalPages / pagesPerDoc) and lastDocPages equals totalPages % pagesPerDoc || pagesPerDoc',
    (totalPages, pagesPerDoc) => {
      const { numDocuments, lastDocPages } = calculateSplitInfo(totalPages, pagesPerDoc);

      const expectedNumDocuments = Math.ceil(totalPages / pagesPerDoc);
      if (numDocuments !== expectedNumDocuments) {
        throw new Error(
          `Expected numDocuments=${expectedNumDocuments} but got ${numDocuments} for totalPages=${totalPages}, pagesPerDoc=${pagesPerDoc}`,
        );
      }

      const expectedLastDocPages = totalPages % pagesPerDoc || pagesPerDoc;
      if (lastDocPages !== expectedLastDocPages) {
        throw new Error(
          `Expected lastDocPages=${expectedLastDocPages} but got ${lastDocPages} for totalPages=${totalPages}, pagesPerDoc=${pagesPerDoc}`,
        );
      }
    },
  );
});

import { splitPdf } from '../pdfSplitService.js';
import { PDFDocument } from 'pdf-lib';
import { writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * Feature: pdf-serial-letter-splitter, Property 7: PDF-Split-Round-Trip
 *
 * Validates: Requirements 8.4
 *
 * For all valid PDFs and arbitrary pages-per-document values,
 * splitting the source PDF into target documents and then merging
 * all target documents back together shall yield a document with
 * the same page count as the original.
 */
describe('Feature: pdf-serial-letter-splitter, Property 7: PDF-Split-Round-Trip', () => {
  const pageCountArb = fc.integer({ min: 1, max: 20 });
  const pagesPerDocArb = fc.integer({ min: 1, max: 10 });

  test.prop([pageCountArb, pagesPerDocArb], { numRuns: 20 })(
    'splitting and re-merging a PDF preserves the total page count',
    async (pageCount, pagesPerDoc) => {
      const testDir = join(tmpdir(), `slicepdf-prop7-${randomUUID()}`);
      const sourcePath = join(testDir, 'source.pdf');
      const outputDir = join(testDir, 'output');

      try {
        // 1. Create a test PDF with the given number of pages
        const sourcePdf = await PDFDocument.create();
        for (let i = 0; i < pageCount; i++) {
          sourcePdf.addPage();
        }
        const sourceBytes = await sourcePdf.save();

        // Write source PDF to temp directory
        const { mkdir } = await import('node:fs/promises');
        await mkdir(testDir, { recursive: true });
        await writeFile(sourcePath, sourceBytes);

        // 2. Split the PDF
        const results = await splitPdf(sourcePath, pagesPerDoc, outputDir);

        // 3. Merge all resulting PDFs back together
        const mergedPdf = await PDFDocument.create();
        for (const result of results) {
          const partBytes = await readFile(result.filePath);
          const partPdf = await PDFDocument.load(partBytes);
          const pageIndices = Array.from({ length: partPdf.getPageCount() }, (_, i) => i);
          const copiedPages = await mergedPdf.copyPages(partPdf, pageIndices);
          for (const page of copiedPages) {
            mergedPdf.addPage(page);
          }
        }

        // 4. Assert: merged PDF has same page count as original
        const mergedPageCount = mergedPdf.getPageCount();
        if (mergedPageCount !== pageCount) {
          throw new Error(
            `Expected merged page count=${pageCount} but got ${mergedPageCount} (pagesPerDoc=${pagesPerDoc})`,
          );
        }
      } finally {
        // 5. Clean up temp files
        await rm(testDir, { recursive: true, force: true });
      }
    },
  );
});
