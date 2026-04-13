import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const BASE_TEMP_DIR = '/tmp/slicepdf';

export function getSessionTempDir(sessionId: string): string {
  return join(BASE_TEMP_DIR, sessionId);
}

export function getDocumentsDir(sessionId: string): string {
  return join(BASE_TEMP_DIR, sessionId, 'documents');
}

export function getThumbnailsDir(sessionId: string): string {
  return join(BASE_TEMP_DIR, sessionId, 'thumbnails');
}

export async function createSessionTempDir(sessionId: string): Promise<string> {
  const sessionDir = getSessionTempDir(sessionId);
  await mkdir(getDocumentsDir(sessionId), { recursive: true });
  await mkdir(getThumbnailsDir(sessionId), { recursive: true });
  return sessionDir;
}
