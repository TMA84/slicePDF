import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import app from '../../index.js';
import { _getStore, createSession } from '../../utils/sessionStore.js';
import { createSessionTempDir } from '../../utils/tempDir.js';

afterEach(() => {
  _getStore().clear();
});

/** Create a minimal valid PDF buffer with the given number of pages. */
async function createTestPdf(pageCount = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// POST /api/upload
// ---------------------------------------------------------------------------
describe('POST /api/upload', () => {
  it('returns 200 with sessionId, totalPages, filename for a valid PDF', async () => {
    const pdfBuffer = await createTestPdf(3);

    const res = await request(app)
      .post('/api/upload')
      .attach('pdf', pdfBuffer, 'test.pdf');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.totalPages).toBe(3);
    expect(res.body.filename).toBe('test.pdf');
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/api/upload');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for a non-PDF file', async () => {
    const textBuffer = Buffer.from('This is not a PDF');

    const res = await request(app)
      .post('/api/upload')
      .attach('pdf', textBuffer, 'readme.txt');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});


// ---------------------------------------------------------------------------
// POST /api/process
// ---------------------------------------------------------------------------
describe('POST /api/process', () => {
  it('returns 404 for an invalid / non-existent session', async () => {
    const res = await request(app)
      .post('/api/process')
      .send({ sessionId: 'does-not-exist', pagesPerDocument: 1 });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when pagesPerDocument is missing', async () => {
    // Create a real session so we pass the session check
    const sessionId = 'proc-missing-ppd';
    const tempDir = await createSessionTempDir(sessionId);
    createSession(sessionId, tempDir);

    const res = await request(app)
      .post('/api/process')
      .send({ sessionId });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when pagesPerDocument < 1', async () => {
    const sessionId = 'proc-ppd-zero';
    const tempDir = await createSessionTempDir(sessionId);
    createSession(sessionId, tempDir);

    const res = await request(app)
      .post('/api/process')
      .send({ sessionId, pagesPerDocument: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// POST /api/download
// ---------------------------------------------------------------------------
describe('POST /api/download', () => {
  it('returns 404 when session does not exist', async () => {
    const res = await request(app)
      .post('/api/download')
      .send({
        sessionId: 'no-such-session',
        documents: [{ index: 0, filename: 'doc.pdf' }],
        mode: 'zip',
      });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/session/:sessionId
// ---------------------------------------------------------------------------
describe('DELETE /api/session/:sessionId', () => {
  it('returns 200 with success: true for a valid session', async () => {
    const sessionId = 'cleanup-valid';
    const tempDir = await createSessionTempDir(sessionId);
    createSession(sessionId, tempDir);

    const res = await request(app).delete(`/api/session/${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Session should be gone
    expect(_getStore().has(sessionId)).toBe(false);
  });

  it('returns 200 for a non-existent session (idempotent)', async () => {
    const res = await request(app).delete('/api/session/non-existent-id');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
