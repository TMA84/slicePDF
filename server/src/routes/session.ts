import { Router } from 'express';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { getSession } from '../utils/sessionStore.js';
import { getThumbnailsDir } from '../utils/tempDir.js';
import { cleanupSession } from '../services/cleanupService.js';
import type { CleanupResponse } from '../types.js';

const router = Router();

/**
 * GET /thumbnail/:sessionId/:docIndex
 * Serve a thumbnail PNG for a specific document in a session.
 */
router.get('/thumbnail/:sessionId/:docIndex', async (req, res) => {
  try {
    const { sessionId, docIndex } = req.params;
    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const idx = Number(docIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      res.status(400).json({ error: 'Invalid document index.' });
      return;
    }

    const paddedIndex = String(idx).padStart(3, '0');
    const thumbnailPath = join(getThumbnailsDir(sessionId), `thumb-${paddedIndex}.png`);

    try {
      await access(thumbnailPath);
    } catch {
      res.status(404).json({ error: 'Thumbnail not found.' });
      return;
    }

    res.setHeader('Content-Type', 'image/png');
    res.sendFile(thumbnailPath);
  } catch (err) {
    console.error('Thumbnail error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * DELETE /session/:sessionId
 * Manually destroy a session and clean up all temporary files.
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await cleanupSession(sessionId);

    const response: CleanupResponse = {
      success: true,
      message: 'Session cleaned up',
    };
    res.json(response);
  } catch (err) {
    console.error('Session cleanup error:', err);
    res.status(500).json({ error: 'Internal server error during cleanup.' });
  }
});

export default router;
