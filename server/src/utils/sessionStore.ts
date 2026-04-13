import fs from 'node:fs/promises';
import type { SessionData } from '../types.js';

const store = new Map<string, SessionData>();

export function _getStore(): Map<string, SessionData> {
  return store;
}

export function createSession(sessionId: string, tempDir: string): void {
  const now = Date.now();
  store.set(sessionId, {
    sessionId,
    tempDir,
    createdAt: now,
    lastActivity: now,
    sourcePdfPath: null,
    totalPages: 0,
    splitDocuments: [],
    jobId: null,
    status: 'uploaded',
  });
}

export function getSession(sessionId: string): SessionData | null {
  return store.get(sessionId) ?? null;
}

export function updateSession(sessionId: string, update: Partial<SessionData>): void {
  const session = store.get(sessionId);
  if (!session) return;
  Object.assign(session, update, { lastActivity: Date.now() });
}

export async function destroySession(sessionId: string): Promise<void> {
  const session = store.get(sessionId);
  if (!session) return;
  store.delete(sessionId);
  await fs.rm(session.tempDir, { recursive: true, force: true });
}

export async function cleanupExpiredSessions(maxAgeMs: number): Promise<number> {
  const now = Date.now();
  let count = 0;
  const entries = [...store.entries()];
  for (const [id, session] of entries) {
    if (now - session.lastActivity > maxAgeMs) {
      await destroySession(id);
      count++;
    }
  }
  return count;
}
