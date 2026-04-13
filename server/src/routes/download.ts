import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { sessionMiddleware } from '../middleware/sessionMiddleware.js';
import { cleanupSession } from '../services/cleanupService.js';
import type { SessionData, DownloadRequest } from '../types.js';

const router = Router();

router.post('/', sessionMiddleware, async (req, res) => {
  try {
    const session = res.locals['session'] as SessionData;
    const { mode, documents, singleIndex } = req.body as DownloadRequest;

    if (!session.splitDocuments || session.splitDocuments.length === 0) {
      res.status(400).json({ error: 'No split documents available. Process the PDF first.' });
      return;
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({ error: 'documents array is required and must not be empty.' });
      return;
    }

    if (mode === 'zip') {
      const zip = new JSZip();

      for (const doc of documents) {
        const splitDoc = session.splitDocuments[doc.index];
        if (!splitDoc) {
          res.status(400).json({ error: `Document index ${doc.index} not found.` });
          return;
        }
        const pdfBuffer = await readFile(splitDoc.filePath);
        zip.file(doc.filename, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', 'attachment; filename="documents.zip"');
      res.send(zipBuffer);
    } else if (mode === 'single') {
      if (singleIndex == null || typeof singleIndex !== 'number') {
        res.status(400).json({ error: 'singleIndex is required for single mode.' });
        return;
      }

      const splitDoc = session.splitDocuments[singleIndex];
      if (!splitDoc) {
        res.status(400).json({ error: `Document index ${singleIndex} not found.` });
        return;
      }

      const matchingDoc = documents.find((d) => d.index === singleIndex);
      const filename = matchingDoc?.filename ?? `document-${singleIndex}.pdf`;

      const pdfBuffer = await readFile(splitDoc.filePath);

      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } else {
      res.status(400).json({ error: 'Invalid mode. Must be "zip" or "single".' });
      return;
    }

    // Only clean up after ZIP download (all documents downloaded at once).
    // Single-file downloads should NOT trigger cleanup so the user can
    // download more files from the same session.
    if (mode === 'zip') {
      cleanupSession(session.sessionId).catch((err) => {
        console.error('Post-download cleanup failed:', err);
      });
    }
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Internal server error during download.' });
  }
});

export default router;
