import { Router } from 'express';
import { jobStore } from './process.js';
import { cleanupSession } from '../services/cleanupService.js';

const router = Router();

const POLL_INTERVAL_MS = 200;

router.get('/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId as string);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let sentIndex = 0;
  let closed = false;

  const interval = setInterval(() => {
    if (closed) return;

    // Send any unsent events
    while (sentIndex < job.events.length) {
      const event = job.events[sentIndex]!;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      sentIndex++;

      // If we just sent a 'done' or 'error' event, close the connection
      if (event.phase === 'done' || event.phase === 'error') {
        clearInterval(interval);
        res.end();
        closed = true;
        return;
      }
    }
  }, POLL_INTERVAL_MS);

  // Client disconnect: clear interval and trigger session cleanup
  req.on('close', () => {
    if (closed) return;
    closed = true;
    clearInterval(interval);

    // Trigger session cleanup on disconnect (fire-and-forget)
    if (job.sessionId) {
      cleanupSession(job.sessionId).catch((err) => {
        console.error('Cleanup after SSE disconnect failed:', err);
      });
    }
  });
});

export default router;
