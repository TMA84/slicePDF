import type { Request, Response, NextFunction } from 'express';
import { getSession } from '../utils/sessionStore.js';

/**
 * Middleware that extracts sessionId from request body or route params,
 * validates the session exists, and attaches it to `res.locals.session`.
 * Returns 400 if no sessionId provided, 404 if session not found.
 */
export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const raw =
    (req.body as Record<string, unknown> | undefined)?.['sessionId'] ??
    req.params['sessionId'];

  const sessionId = typeof raw === 'string' ? raw : undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.locals['session'] = session;
  next();
}
