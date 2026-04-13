import { destroySession, cleanupExpiredSessions } from '../utils/sessionStore.js';

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Start periodic cleanup that removes sessions older than 30 minutes.
 * Runs every 5 minutes. Returns the interval handle for later cleanup.
 */
export function startPeriodicCleanup(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    cleanupExpiredSessions(SESSION_MAX_AGE_MS).catch((err) => {
      console.error('Periodic session cleanup failed:', err);
    });
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the periodic cleanup interval.
 */
export function stopPeriodicCleanup(handle: ReturnType<typeof setInterval>): void {
  clearInterval(handle);
}

/**
 * Clean up a single session — delegates to sessionStore.destroySession.
 * Called by routes after successful download or on SSE disconnect.
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  await destroySession(sessionId);
}
