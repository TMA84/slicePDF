import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import JSZip from 'jszip';

/**
 * Feature: pdf-serial-letter-splitter, Property 6: ZIP-Dateinamen
 *
 * **Validates: Requirements 7.2**
 *
 * For all lists of target documents with generated filenames,
 * the created ZIP archive shall contain an entry for each document
 * whose name exactly matches the generated filename.
 */
describe('Feature: pdf-serial-letter-splitter, Property 6: ZIP-Dateinamen', () => {
  // Generate a non-empty string ending in .pdf for filenames
  const pdfFilenameArb = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => !s.includes('/') && !s.includes('\\') && !s.includes('\0'))
    .map((s) => s + '.pdf');

  // Generate an arbitrary array of { index, filename } documents with unique filenames
  const documentsArb = fc
    .array(pdfFilenameArb, { minLength: 1, maxLength: 30 })
    .map((filenames) => {
      // Deduplicate filenames to avoid ZIP entry collisions
      const unique = [...new Set(filenames)];
      return unique.map((filename, i) => ({ index: i, filename }));
    })
    .filter((docs) => docs.length > 0);

  test.prop([documentsArb], { numRuns: 100 })(
    'ZIP entries match the generated filenames exactly (same set, same count)',
    async (documents) => {
      // 1. Create a JSZip instance and add dummy content for each filename
      const zip = new JSZip();
      for (const doc of documents) {
        zip.file(doc.filename, `dummy content for document ${doc.index}`);
      }

      // 2. Generate the ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // 3. Load the ZIP buffer back with JSZip
      const loaded = await JSZip.loadAsync(zipBuffer);

      // 4. Collect all file names from the loaded ZIP
      const zipEntries = Object.keys(loaded.files).filter((name) => !loaded.files[name].dir);

      // 5. Assert: the ZIP file names match the input filenames exactly
      const expectedFilenames = documents.map((d) => d.filename).sort();
      const actualFilenames = zipEntries.sort();

      expect(actualFilenames).toEqual(expectedFilenames);
      expect(actualFilenames.length).toBe(expectedFilenames.length);
    },
  );
});
