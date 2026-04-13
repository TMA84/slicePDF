// Backend interfaces for slicePDF

export interface UploadResponse {
  sessionId: string;
  totalPages: number;
  filename: string;
}

export interface ProcessRequest {
  sessionId: string;
  pagesPerDocument: number;
  extractNames: boolean;
}

export interface ProcessResponse {
  jobId: string;
}

export interface ProgressEvent {
  phase: 'splitting' | 'extracting' | 'thumbnails' | 'done' | 'error';
  progress: number;
  currentDoc?: number;
  totalDocs?: number;
  message?: string;
}

export interface DoneEvent extends ProgressEvent {
  phase: 'done';
  documents: DocumentInfo[];
}

export interface DocumentInfo {
  index: number;
  pageRange: { start: number; end: number };
  extractedName: { vorname: string; nachname: string } | null;
  extractionFailed: boolean;
  thumbnailUrl: string;
}

export interface DownloadRequest {
  sessionId: string;
  documents: DownloadDocument[];
  mode: 'zip' | 'single';
  singleIndex?: number;
}

export interface DownloadDocument {
  index: number;
  filename: string;
}

export interface CleanupResponse {
  success: boolean;
  message: string;
}

export interface SplitResult {
  index: number;
  filePath: string;
  pageRange: { start: number; end: number };
  pageCount: number;
}

export interface ExtractedName {
  vorname: string;
  nachname: string;
  raw: string;
}

export interface SessionData {
  sessionId: string;
  tempDir: string;
  createdAt: number;
  lastActivity: number;
  sourcePdfPath: string | null;
  totalPages: number;
  splitDocuments: SplitResult[];
  jobId: string | null;
  status: 'uploaded' | 'processing' | 'done' | 'error';
}
