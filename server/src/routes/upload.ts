import { Router } from 'express';
import { readFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import upload from '../middleware/uploadMiddleware.js';
import { createSession, updateSession } from '../utils/sessionStore.js';
import { createSessionTempDir } from '../utils/tempDir.js';
import type { UploadResponse } from '../types.js';

const router = Router();

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    // Read file and validate PDF magic bytes
    const buffer = await readFile(file.path);
    const header = buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      res.status(400).json({ error: 'Die hochgeladene Datei ist kein gültiges PDF.' });
      return;
    }

    // Validate with pdf-lib
    try {
      await PDFDocument.load(buffer);
    } catch {
      res.status(400).json({ error: 'Die hochgeladene Datei ist kein gültiges PDF.' });
      return;
    }

    // Generate session
    const sessionId = crypto.randomUUID();
    const tempDir = await createSessionTempDir(sessionId);
    createSession(sessionId, tempDir);

    // Move uploaded file to session temp dir
    const sourcePdfPath = join(tempDir, 'source.pdf');
    try {
      await rename(file.path, sourcePdfPath);
    } catch {
      // rename can fail across filesystems, fall back to copy
      await copyFile(file.path, sourcePdfPath);
    }

    // Extract page count with pdfjs-dist
    const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const pdf = await getDocument({ data }).promise;
    const totalPages = pdf.numPages;
    await pdf.destroy();

    // Update session
    updateSession(sessionId, { sourcePdfPath, totalPages });

    const response: UploadResponse = {
      sessionId,
      totalPages,
      filename: file.originalname,
    };

    res.json(response);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error during upload.' });
  }
});

// Handle Multer errors (file too large, etc.)
export function handleMulterError(
  err: unknown,
  _req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): void {
  if (err && typeof err === 'object' && 'code' in err) {
    const multerErr = err as { code: string; message: string };
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Die Datei überschreitet die maximale Größe von 200 MB.' });
      return;
    }
  }
  if (err instanceof Error && err.message === 'Only PDF files are allowed') {
    res.status(400).json({ error: 'Die hochgeladene Datei ist kein gültiges PDF.' });
    return;
  }
  next(err);
}

export default router;
