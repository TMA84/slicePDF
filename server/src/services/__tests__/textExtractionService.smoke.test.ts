import { describe, it, expect } from 'vitest';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument } from 'pdf-lib';
import { extractTextFromPage } from '../textExtractionService.js';

describe('extractTextFromPage', () => {
  it('should extract text from a PDF page', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 200]);
    page.drawText('Hello World', { x: 10, y: 100, size: 12 });
    const bytes = await pdf.save();

    const filePath = join(tmpdir(), `test-extract-${Date.now()}.pdf`);
    await writeFile(filePath, bytes);

    try {
      const text = await extractTextFromPage(filePath, 0);
      expect(text).toContain('Hello World');
    } finally {
      await unlink(filePath).catch(() => {});
    }
  });

  it('should extract text from a specific page index', async () => {
    const pdf = await PDFDocument.create();
    const page1 = pdf.addPage([200, 200]);
    page1.drawText('Page One', { x: 10, y: 100, size: 12 });
    const page2 = pdf.addPage([200, 200]);
    page2.drawText('Page Two', { x: 10, y: 100, size: 12 });
    const bytes = await pdf.save();

    const filePath = join(tmpdir(), `test-extract-multi-${Date.now()}.pdf`);
    await writeFile(filePath, bytes);

    try {
      const text = await extractTextFromPage(filePath, 1);
      expect(text).toContain('Page Two');
    } finally {
      await unlink(filePath).catch(() => {});
    }
  });
});
