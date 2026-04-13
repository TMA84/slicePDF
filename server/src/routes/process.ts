import { Router } from 'express';
import crypto from 'node:crypto';
import { join } from 'node:path';
import { sessionMiddleware } from '../middleware/sessionMiddleware.js';
import { updateSession } from '../utils/sessionStore.js';
import { getDocumentsDir, getThumbnailsDir } from '../utils/tempDir.js';
import { splitPdf } from '../services/pdfSplitService.js';
import { extractTextFromPage } from '../services/textExtractionService.js';
import { extractName } from '../services/nameExtractionService.js';
import { renderThumbnail } from '../services/thumbnailService.js';
import type { ProcessResponse, DocumentInfo, ProgressEvent, DoneEvent, SessionData } from '../types.js';

/** Progress event stored in the job's event queue. */
export type JobEvent = ProgressEvent | DoneEvent;

export interface JobData {
  sessionId: string;
  status: 'processing' | 'done' | 'error';
  events: JobEvent[];
  documents: DocumentInfo[];
}

/** In-memory job store – exported so the SSE progress route can read it. */
export const jobStore = new Map<string, JobData>();

const router = Router();

router.post('/', sessionMiddleware, async (req, res) => {
  try {
    const session = res.locals['session'] as SessionData;
    const body = req.body as Record<string, unknown>;
    const pagesPerDocument = Number(body['pagesPerDocument']);

    // Validate pagesPerDocument
    if (!Number.isFinite(pagesPerDocument) || pagesPerDocument < 1) {
      res.status(400).json({ error: 'pagesPerDocument must be a number >= 1' });
      return;
    }

    if (!session.sourcePdfPath) {
      res.status(400).json({ error: 'No PDF uploaded for this session' });
      return;
    }

    // Generate jobId and update session
    const jobId = crypto.randomUUID();
    updateSession(session.sessionId, { jobId, status: 'processing' });

    // Initialise job store entry
    const job: JobData = {
      sessionId: session.sessionId,
      status: 'processing',
      events: [],
      documents: [],
    };
    jobStore.set(jobId, job);

    // Return immediately
    const response: ProcessResponse = { jobId };
    res.json(response);

    // --- Background processing (fire-and-forget) ---
    processInBackground(session, jobId, pagesPerDocument).catch((err) => {
      console.error('Background processing error:', err);
      const j = jobStore.get(jobId);
      if (j) {
        const errorEvent: ProgressEvent = {
          phase: 'error',
          progress: 0,
          message: err instanceof Error ? err.message : 'Unknown processing error',
        };
        j.events.push(errorEvent);
        j.status = 'error';
      }
      updateSession(session.sessionId, { status: 'error' });
    });
  } catch (err) {
    console.error('Process route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function processInBackground(
  session: SessionData,
  jobId: string,
  pagesPerDocument: number,
): Promise<void> {
  const job = jobStore.get(jobId);
  if (!job) return;

  const documentsDir = getDocumentsDir(session.sessionId);
  const thumbnailsDir = getThumbnailsDir(session.sessionId);

  // 1. Split PDF
  const pushEvent = (evt: JobEvent) => { job.events.push(evt); };

  const splitResults = await splitPdf(
    session.sourcePdfPath!,
    pagesPerDocument,
    documentsDir,
    (progress) => {
      pushEvent({ phase: 'splitting', progress });
    },
  );

  const totalDocs = splitResults.length;

  // 2. For each split document: extract text → extract name → render thumbnail
  const documents: DocumentInfo[] = [];

  for (let i = 0; i < splitResults.length; i++) {
    const split = splitResults[i]!;

    // Extract text from first page
    let text = '';
    try {
      text = await extractTextFromPage(split.filePath, 0);
    } catch {
      // text extraction may fail for image-only PDFs
    }

    // Extract name from text
    const extracted = extractName(text);

    pushEvent({
      phase: 'extracting',
      progress: Math.round(((i + 1) / totalDocs) * 100),
      currentDoc: i,
      totalDocs,
    });

    // Render thumbnail
    const thumbPath = join(thumbnailsDir, `thumb-${String(i).padStart(3, '0')}.png`);
    try {
      await renderThumbnail(split.filePath, 0, thumbPath, 0.5);
    } catch {
      // thumbnail rendering may fail; continue without it
    }

    pushEvent({
      phase: 'thumbnails',
      progress: Math.round(((i + 1) / totalDocs) * 100),
      currentDoc: i,
      totalDocs,
    });

    const docInfo: DocumentInfo = {
      index: split.index,
      pageRange: split.pageRange,
      extractedName: extracted ? { vorname: extracted.vorname, nachname: extracted.nachname } : null,
      extractionFailed: extracted === null,
      thumbnailUrl: `/api/thumbnail/${session.sessionId}/${i}`,
    };

    documents.push(docInfo);
  }

  // 3. Finalise
  job.documents = documents;
  job.status = 'done';

  const doneEvent: DoneEvent = {
    phase: 'done',
    progress: 100,
    documents,
  };
  pushEvent(doneEvent);

  // Update session
  updateSession(session.sessionId, {
    splitDocuments: splitResults,
    status: 'done',
  });
}

export default router;
