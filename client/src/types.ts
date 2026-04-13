// Frontend interfaces for slicePDF

export interface TemplateVariables {
  nachname: string;
  vorname: string;
  dokument: string;
  datum: string;
  nummer: number | string;
  [key: string]: string | number;
}

export interface TemplatePart {
  type: 'literal' | 'variable';
  value: string;
}

export interface VariableDefinition {
  name: string;
  key: string;
  source: 'system' | 'xlsx' | 'custom';
  description: string;
}

export interface CustomVariable {
  key: string;
  label: string;
  value: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface XlsxInfo {
  headers: string[];
  rowCount: number;
  sheetName: string;
  rawData: unknown[][];
}

export interface NameMapping {
  vorname: string;
  nachname: string;
  additionalFields: Record<string, string>;
}

export interface ExtractedName {
  vorname: string;
  nachname: string;
  raw: string;
}

export interface SourcePdfState {
  filename: string;
  totalPages: number;
  fileSize: number;
}

export interface XlsxState {
  file: File;
  info: XlsxInfo;
  vornameColumn: string | null;
  nachnameColumn: string | null;
  mappings: NameMapping[];
}

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'splitting' | 'extracting' | 'thumbnails' | 'done' | 'error';
  progress: number;
  currentDoc: number | null;
  totalDocs: number | null;
  message: string | null;
  error: string | null;
}

export interface DocumentState {
  index: number;
  pageRange: { start: number; end: number };
  extractedName: ExtractedName | null;
  nameSource: 'extracted' | 'xlsx' | 'manual';
  extractionFailed: boolean;
  vorname: string;
  nachname: string;
  thumbnailUrl: string | null;
  generatedFilename: string;
}

export interface AppState {
  sessionId: string | null;
  sourcePdf: SourcePdfState | null;
  xlsxData: XlsxState | null;
  pagesPerDocument: number;
  filenameTemplate: string;
  dateFormat: string;
  dokumentName: string;
  customVariables: CustomVariable[];
  processing: ProcessingState;
  documents: DocumentState[];
  showDownload: boolean;
}
