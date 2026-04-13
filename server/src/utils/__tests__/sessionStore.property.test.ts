import { describe, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createSession,
  getSession,
  destroySession,
  _getStore,
} from '../sessionStore.js';
import { createSessionTempDir } from '../tempDir.js';

/**
 * Feature: pdf-serial-letter-splitter, Property 8: Session-Cleanup
 *
 * Validates: Requirements 9.1, 9.2, 9.4
 *
 * For all sessions that have uploaded and processed files,
 * after calling destroySession the associated temp directory
 * shall be completely deleted with no files or subdirectories remaining.
 */

afterEach(() => {
  _getStore().clear();
});

describe('Feature: pdf-serial-letter-splitter, Property 8: Session-Cleanup', () => {
  const sessionIdArb = fc.stringMatching(/^[a-z0-9]{8,32}$/);
  const fileCountArb = fc.integer({ min: 1, max: 5 });

  test.prop([sessionIdArb, fileCountArb], { numRuns: 20 })(
    'destroySession removes the temp directory and clears the session from the store',
    async (sessionId, fileCount) => {
      // a. Create a temp directory for the session
      const tempDir = await createSessionTempDir(sessionId);

      // b. Create the session in the store
      createSession(sessionId, tempDir);

      // c. Write arbitrary files into documents/ and thumbnails/ subdirectories
      const docsDir = join(tempDir, 'documents');
      const thumbsDir = join(tempDir, 'thumbnails');

      for (let i = 0; i < fileCount; i++) {
        await writeFile(join(docsDir, `doc-${i}.pdf`), `pdf-content-${i}`);
        await writeFile(join(thumbsDir, `thumb-${i}.png`), `png-content-${i}`);
      }

      // d. Call destroySession
      await destroySession(sessionId);

      // e. Assert: the session temp directory no longer exists
      await access(tempDir).then(
        () => {
          throw new Error(`Expected temp directory ${tempDir} to be deleted, but it still exists`);
        },
        () => {
          // Expected: access throws because directory doesn't exist
        },
      );

      // f. Assert: getSession returns null
      const session = getSession(sessionId);
      if (session !== null) {
        throw new Error(`Expected getSession("${sessionId}") to return null, but got a session`);
      }
    },
  );
});
