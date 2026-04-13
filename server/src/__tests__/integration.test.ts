import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { existsSync } from 'node:fs';
import app from '../index.js';
import { getSession, _getStore } from '../utils/sessionStore.js';
import { getSessionTempDir } from '../utils/tempDir.js';
import { jobStore } from '../routes/process.js';

/** Create a test PDF with the given number of blank pages using pdf-lib. */
async function createTestPdf(pageCount: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([200, 200]);
    page.drawText(`Page ${i + 1}`, { x: 10, y: 100, size: 12 });
  }
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/** Wait for a job to reach 'done' or 'error' status, polling the jobStore. */
async function waitForJob(jobId: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = jobStore.get(jobId);
    if (job && (job.status === 'done' || job.status === 'error')) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

// Track sessions created during tests for cleanup
const createdSessions: string[] = [];

afterEach(async () => {
  // Clean up any sessions created during the test
  for (const sid of createdSessions) {
    try {
      await request(app).delete(`/api/session/${sid}`);
    } catch {
      // ignore cleanup errors
    }
  }
  createdSessions.length = 0;
});

describe('Integration: Full flow – Upload → Process → Download ZIP → Cleanup', () => {
  it('uploads a 4-page PDF, processes with pagesPerDoc=2, downloads ZIP, then cleans up', async () => {
    const pdfBuffer = await createTestPdf(4);

    // 1. Upload
    const uploadRes = await request(app)
      .post('/api/upload')
      .attach('pdf', pdfBuffer, 'test.pdf')
      .expect(200);

    const { sessionId, totalPages, filename } = uploadRes.body;
    createdSessions.push(sessionId);

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(totalPages).toBe(4);
    expect(filename).toBe('test.pdf');

    // Verify session exists
    const session = getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session!.status).toBe('uploaded');

    // 2. Process
    const processRes = await request(app)
      .post('/api/process')
      .send({ sessionId, pagesPerDocument: 2 })
      .expect(200);

    const { jobId } = processRes.body;
    expect(jobId).toBeDefined();

    // 3. Wait for processing to complete
    await waitForJob(jobId);

    const job = jobStore.get(jobId)!;
    expect(job.status).toBe('done');
    expect(job.documents).toHaveLength(2);
    expect(job.documents[0].pageRange).toEqual({ start: 0, end: 1 });
    expect(job.documents[1].pageRange).toEqual({ start: 2, end: 3 });

    // 4. Download ZIP
    const downloadRes = await request(app)
      .post('/api/download')
      .send({
        sessionId,
        mode: 'zip',
        documents: [
          { index: 0, filename: 'doc-001.pdf' },
          { index: 1, filename: 'doc-002.pdf' },
        ],
      })
      .responseType('blob')
      .expect(200);

    expect(downloadRes.headers['content-type']).toMatch(/application\/zip/);

    // Verify ZIP contents – supertest returns a Buffer when using responseType('blob')
    const zip = await JSZip.loadAsync(downloadRes.body as Buffer);
    const zipFiles = Object.keys(zip.files);
    expect(zipFiles).toContain('doc-001.pdf');
    expect(zipFiles).toContain('doc-002.pdf');
    expect(zipFiles).toHaveLength(2);

    // Verify each ZIP entry is a valid PDF
    for (const name of zipFiles) {
      const content = await zip.files[name].async('uint8array');
      const header = new TextDecoder().decode(content.slice(0, 5));
      expect(header).toBe('%PDF-');
    }

    // 5. Cleanup (download triggers fire-and-forget cleanup, but we also call explicitly)
    // Wait a moment for fire-and-forget cleanup
    await new Promise((r) => setTimeout(r, 200));

    // Session may already be cleaned up by download; if not, clean up manually
    const sessionAfterDownload = getSession(sessionId);
    if (sessionAfterDownload) {
      const cleanupRes = await request(app)
        .delete(`/api/session/${sessionId}`)
        .expect(200);
      expect(cleanupRes.body.success).toBe(true);
    }

    // Verify session is gone
    expect(getSession(sessionId)).toBeNull();

    // Verify temp directory is gone
    const tempDir = getSessionTempDir(sessionId);
    expect(existsSync(tempDir)).toBe(false);

    // Remove from cleanup list since we already cleaned up
    const idx = createdSessions.indexOf(sessionId);
    if (idx >= 0) createdSessions.splice(idx, 1);
  });
});


describe('Integration: Session lifecycle – Upload → Cleanup → Verify gone', () => {
  it('creates a session via upload, deletes it, then process returns 404', async () => {
    const pdfBuffer = await createTestPdf(2);

    // 1. Upload
    const uploadRes = await request(app)
      .post('/api/upload')
      .attach('pdf', pdfBuffer, 'lifecycle.pdf')
      .expect(200);

    const { sessionId } = uploadRes.body;
    createdSessions.push(sessionId);

    // Verify session exists
    expect(getSession(sessionId)).not.toBeNull();

    // 2. Delete session
    const cleanupRes = await request(app)
      .delete(`/api/session/${sessionId}`)
      .expect(200);
    expect(cleanupRes.body.success).toBe(true);

    // 3. Verify session is gone from store
    expect(getSession(sessionId)).toBeNull();

    // 4. Verify temp directory is deleted
    const tempDir = getSessionTempDir(sessionId);
    expect(existsSync(tempDir)).toBe(false);

    // 5. Attempt to process with the deleted session → 404
    const processRes = await request(app)
      .post('/api/process')
      .send({ sessionId, pagesPerDocument: 1 })
      .expect(404);

    expect(processRes.body.error).toMatch(/Session not found/i);

    // Remove from cleanup list since already cleaned up
    const idx = createdSessions.indexOf(sessionId);
    if (idx >= 0) createdSessions.splice(idx, 1);
  });
});

describe('Integration: XLSX parsing → column mapping → name assignment', () => {
  it('parses XLSX data and maps columns to name entries in order', async () => {
    // This is a unit-level integration test for the client-side XLSX service.
    // We import the readColumns function and test it with constructed XlsxInfo data.
    // (loadXlsx requires a File object which is browser-only, so we test readColumns directly)

    // Dynamically import from client source (it's pure TS, no browser APIs in readColumns)
    const { readColumns } = await import(
      '../../../client/src/services/xlsxService.js'
    );

    const xlsxData = {
      headers: ['Vorname', 'Nachname', 'Abteilung'],
      rowCount: 3,
      sheetName: 'Sheet1',
      rawData: [
        ['Tobias', 'Malcherek', 'IT'],
        ['Anna', 'Schmidt', 'HR'],
        ['Max', 'Müller', 'Finance'],
      ],
    };

    const mappings = readColumns(xlsxData, 'Vorname', 'Nachname');

    expect(mappings).toHaveLength(3);

    // Verify order and values
    expect(mappings[0]).toEqual({
      vorname: 'Tobias',
      nachname: 'Malcherek',
      additionalFields: { Abteilung: 'IT' },
    });
    expect(mappings[1]).toEqual({
      vorname: 'Anna',
      nachname: 'Schmidt',
      additionalFields: { Abteilung: 'HR' },
    });
    expect(mappings[2]).toEqual({
      vorname: 'Max',
      nachname: 'Müller',
      additionalFields: { Abteilung: 'Finance' },
    });
  });

  it('throws when a specified column does not exist', async () => {
    const { readColumns } = await import(
      '../../../client/src/services/xlsxService.js'
    );

    const xlsxData = {
      headers: ['Name', 'Email'],
      rowCount: 1,
      sheetName: 'Sheet1',
      rawData: [['Test', 'test@example.com']],
    };

    expect(() => readColumns(xlsxData, 'Vorname', 'Nachname')).toThrow(
      /Spalte.*Vorname.*nicht gefunden/,
    );
  });
});
