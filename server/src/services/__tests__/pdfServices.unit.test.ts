import { describe, it, expect } from 'vitest';
import { writeFile, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { splitPdf } from '../pdfSplitService.js';
import { renderThumbnail } from '../thumbnailService.js';

/** Create a test PDF with the given number of blank pages. */
async function createTestPdf(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([200, 200]);
    page.drawText(`Page ${i + 1}`, { x: 10, y: 100, size: 12 });
  }
  return pdf.save();
}

/** Create a unique temp directory path for a test run. */
function tempDir(): string {
  return join(tmpdir(), `slicepdf-test-${randomUUID()}`);
}

describe('splitPdf', () => {
  it('splits a 6-page PDF with pagesPerDoc=2 into 3 documents of 2 pages each', async () => {
    const dir = tempDir();
    const sourcePath = join(dir, 'source.pdf');
    const outputDir = join(dir, 'output');

    try {
      const pdfBytes = await createTestPdf(6);
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dir, { recursive: true });
      await writeFile(sourcePath, pdfBytes);

      const results = await splitPdf(sourcePath, 2, outputDir);

      expect(results).toHaveLength(3);

      // Verify each result
      for (let i = 0; i < 3; i++) {
        expect(results[i].index).toBe(i);
        expect(results[i].pageCount).toBe(2);
        expect(results[i].pageRange).toEqual({ start: i * 2, end: i * 2 + 1 });

        // Verify file exists on disk
        const fileStat = await stat(results[i].filePath);
        expect(fileStat.isFile()).toBe(true);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('splits a 5-page PDF with pagesPerDoc=2 into 3 documents, last has 1 page', async () => {
    const dir = tempDir();
    const sourcePath = join(dir, 'source.pdf');
    const outputDir = join(dir, 'output');

    try {
      const pdfBytes = await createTestPdf(5);
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dir, { recursive: true });
      await writeFile(sourcePath, pdfBytes);

      const results = await splitPdf(sourcePath, 2, outputDir);

      expect(results).toHaveLength(3);

      // First two docs have 2 pages
      expect(results[0].pageCount).toBe(2);
      expect(results[0].pageRange).toEqual({ start: 0, end: 1 });

      expect(results[1].pageCount).toBe(2);
      expect(results[1].pageRange).toEqual({ start: 2, end: 3 });

      // Last doc has 1 page
      expect(results[2].pageCount).toBe(1);
      expect(results[2].pageRange).toEqual({ start: 4, end: 4 });

      // Verify all files exist
      for (const r of results) {
        const fileStat = await stat(r.filePath);
        expect(fileStat.isFile()).toBe(true);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('calls the progress callback for each document', async () => {
    const dir = tempDir();
    const sourcePath = join(dir, 'source.pdf');
    const outputDir = join(dir, 'output');

    try {
      const pdfBytes = await createTestPdf(4);
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dir, { recursive: true });
      await writeFile(sourcePath, pdfBytes);

      const progressValues: number[] = [];
      await splitPdf(sourcePath, 2, outputDir, (p) => progressValues.push(p));

      // 2 documents → 2 progress calls: 50, 100
      expect(progressValues).toHaveLength(2);
      expect(progressValues[0]).toBe(50);
      expect(progressValues[1]).toBe(100);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('verifies output PDFs have the correct page counts', async () => {
    const dir = tempDir();
    const sourcePath = join(dir, 'source.pdf');
    const outputDir = join(dir, 'output');

    try {
      const pdfBytes = await createTestPdf(5);
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dir, { recursive: true });
      await writeFile(sourcePath, pdfBytes);

      const results = await splitPdf(sourcePath, 2, outputDir);

      // Load each output PDF and verify page count
      for (const r of results) {
        const bytes = await readFile(r.filePath);
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(r.pageCount);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('renderThumbnail', () => {
  it('produces a valid PNG file with correct magic bytes', async () => {
    const dir = tempDir();
    const pdfPath = join(dir, 'test.pdf');
    const pngPath = join(dir, 'thumb.png');

    try {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dir, { recursive: true });

      const pdfBytes = await createTestPdf(1);
      await writeFile(pdfPath, pdfBytes);

      const result = await renderThumbnail(pdfPath, 0, pngPath, 0.5);

      expect(result).toBe(pngPath);

      // Verify file exists
      const fileStat = await stat(pngPath);
      expect(fileStat.isFile()).toBe(true);
      expect(fileStat.size).toBeGreaterThan(0);

      // Verify PNG magic bytes: 0x89 0x50 0x4E 0x47
      const pngBuffer = await readFile(pngPath);
      expect(pngBuffer[0]).toBe(0x89);
      expect(pngBuffer[1]).toBe(0x50); // P
      expect(pngBuffer[2]).toBe(0x4e); // N
      expect(pngBuffer[3]).toBe(0x47); // G
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
