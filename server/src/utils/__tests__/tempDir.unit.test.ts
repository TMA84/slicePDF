import { describe, it, expect, afterEach } from 'vitest';
import { rm, stat } from 'node:fs/promises';
import {
  BASE_TEMP_DIR,
  createSessionTempDir,
  getSessionTempDir,
  getDocumentsDir,
  getThumbnailsDir,
} from '../tempDir.js';

const TEST_SESSION_ID = 'test-tempdir-unit-session';

afterEach(async () => {
  await rm(`${BASE_TEMP_DIR}/${TEST_SESSION_ID}`, { recursive: true, force: true });
});

describe('tempDir utilities', () => {
  it('BASE_TEMP_DIR is /tmp/slicepdf', () => {
    expect(BASE_TEMP_DIR).toBe('/tmp/slicepdf');
  });

  it('getSessionTempDir returns correct path', () => {
    expect(getSessionTempDir('abc-123')).toBe('/tmp/slicepdf/abc-123');
  });

  it('getDocumentsDir returns correct path', () => {
    expect(getDocumentsDir('abc-123')).toBe('/tmp/slicepdf/abc-123/documents');
  });

  it('getThumbnailsDir returns correct path', () => {
    expect(getThumbnailsDir('abc-123')).toBe('/tmp/slicepdf/abc-123/thumbnails');
  });

  it('createSessionTempDir creates session dir with subdirectories', async () => {
    const result = await createSessionTempDir(TEST_SESSION_ID);

    expect(result).toBe(getSessionTempDir(TEST_SESSION_ID));

    const sessionStat = await stat(result);
    expect(sessionStat.isDirectory()).toBe(true);

    const docsStat = await stat(getDocumentsDir(TEST_SESSION_ID));
    expect(docsStat.isDirectory()).toBe(true);

    const thumbsStat = await stat(getThumbnailsDir(TEST_SESSION_ID));
    expect(thumbsStat.isDirectory()).toBe(true);
  });

  it('createSessionTempDir is idempotent', async () => {
    await createSessionTempDir(TEST_SESSION_ID);
    await createSessionTempDir(TEST_SESSION_ID);

    const sessionStat = await stat(getSessionTempDir(TEST_SESSION_ID));
    expect(sessionStat.isDirectory()).toBe(true);
  });
});
