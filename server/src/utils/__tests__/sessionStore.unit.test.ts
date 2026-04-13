import { describe, it, expect, afterEach } from 'vitest';
import { access, stat } from 'node:fs/promises';
import {
  createSession,
  getSession,
  updateSession,
  destroySession,
  cleanupExpiredSessions,
  _getStore,
} from '../sessionStore.js';
import { createSessionTempDir } from '../tempDir.js';

afterEach(() => {
  _getStore().clear();
});

describe('SessionStore lifecycle', () => {
  it('createSession → getSession returns the session with correct defaults', () => {
    createSession('sess-1', '/tmp/slicepdf/sess-1');
    const session = getSession('sess-1');

    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe('sess-1');
    expect(session!.tempDir).toBe('/tmp/slicepdf/sess-1');
    expect(session!.sourcePdfPath).toBeNull();
    expect(session!.totalPages).toBe(0);
    expect(session!.splitDocuments).toEqual([]);
    expect(session!.jobId).toBeNull();
    expect(session!.status).toBe('uploaded');
    expect(session!.createdAt).toBeGreaterThan(0);
    expect(session!.lastActivity).toBe(session!.createdAt);
  });

  it('updateSession → getSession reflects the update and refreshes lastActivity', async () => {
    createSession('sess-2', '/tmp/slicepdf/sess-2');
    const before = getSession('sess-2')!.lastActivity;

    // Small delay so lastActivity changes
    await new Promise((r) => setTimeout(r, 10));

    updateSession('sess-2', { totalPages: 42, status: 'processing' });
    const session = getSession('sess-2');

    expect(session!.totalPages).toBe(42);
    expect(session!.status).toBe('processing');
    expect(session!.lastActivity).toBeGreaterThanOrEqual(before);
  });

  it('destroySession → getSession returns null', async () => {
    createSession('sess-3', '/tmp/slicepdf/sess-3');
    await destroySession('sess-3');

    expect(getSession('sess-3')).toBeNull();
  });

  it('getSession for non-existent session returns null', () => {
    expect(getSession('does-not-exist')).toBeNull();
  });
});

describe('cleanupExpiredSessions', () => {
  it('removes only expired sessions and keeps fresh ones', async () => {
    createSession('old-sess', '/tmp/slicepdf/old-sess');
    createSession('fresh-sess', '/tmp/slicepdf/fresh-sess');

    // Manually backdate the old session's lastActivity
    const oldSession = getSession('old-sess')!;
    oldSession.lastActivity = Date.now() - 60_000;

    const removed = await cleanupExpiredSessions(30_000);

    expect(removed).toBe(1);
    expect(getSession('old-sess')).toBeNull();
    expect(getSession('fresh-sess')).not.toBeNull();
  });
});

describe('Temp directory integration', () => {
  it('createSession with real temp dir → destroySession removes the directory', async () => {
    const sessionId = 'tempdir-integration-test';
    const tempDir = await createSessionTempDir(sessionId);

    // Verify directory was created
    const dirStat = await stat(tempDir);
    expect(dirStat.isDirectory()).toBe(true);

    createSession(sessionId, tempDir);
    await destroySession(sessionId);

    // Verify directory is gone
    await expect(access(tempDir)).rejects.toThrow();
    expect(getSession(sessionId)).toBeNull();
  });
});
