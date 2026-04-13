# Implementation Plan: slicePDF – PDF-Serienbrief-Splitter

## Übersicht

Inkrementelle Implementierung der slicePDF-Webanwendung mit React/TypeScript-Frontend und Node.js/Express-Backend. Die Implementierung beginnt mit der Projektstruktur und den Kernservices (Template-Engine, PDF-Splitting), baut dann die API-Schicht und das Frontend auf, und schließt mit Integration, Download und Cleanup ab. Property-Based Tests mit fast-check validieren die 8 Korrektheitseigenschaften aus dem Design.

## Tasks

- [x] 1. Projektstruktur und Basis-Setup
  - [x] 1.1 Initialize monorepo with Vite React-TypeScript frontend and Express backend
    - Create root `package.json` with workspaces or scripts for both client and server
    - Initialize Vite project in `client/` with React, TypeScript, Tailwind CSS
    - Initialize Express project in `server/` with TypeScript (ts-node or tsx)
    - Install shared dev dependencies: `vitest`, `fast-check`
    - Configure `tsconfig.json` for both client and server
    - _Requirements: All (project foundation)_

  - [x] 1.2 Define shared TypeScript interfaces and types
    - Create `server/src/types.ts` with all backend interfaces: `UploadResponse`, `ProcessRequest`, `ProcessResponse`, `ProgressEvent`, `DoneEvent`, `DocumentInfo`, `DownloadRequest`, `DownloadDocument`, `CleanupResponse`, `SplitResult`, `ExtractedName`, `SessionData`
    - Create `client/src/types.ts` with all frontend interfaces: `AppState`, `SourcePdfState`, `XlsxState`, `ProcessingState`, `DocumentState`, `TemplateVariables`, `TemplatePart`, `VariableDefinition`, `CustomVariable`, `ValidationResult`, `XlsxInfo`, `NameMapping`
    - _Requirements: All (type foundation)_

- [x] 2. Template-Engine (clientseitig)
  - [x] 2.1 Implement `TemplateEngine` in `client/src/services/templateEngine.ts`
    - Implement `parseTemplate(template)` – parse `[Variable]` placeholders and literal parts into `TemplatePart[]`
    - Implement `generateFilename(template, variables)` – replace all `[Name]` placeholders with values, append `.pdf`
    - Implement `getAvailableVariables(customVars, xlsxHeaders)` – merge system, XLSX, and custom variables
    - Implement `validateTemplate(template, availableVars)` – warn if no `[...]` found, error on unknown variables
    - Default template: `[Nachname], [Vorname]_[Dokument] - [Datum]`
    - _Requirements: 5.1, 5.2, 5.3, 5.7, 5.8, 5.9, 5.10_

  - [x] 2.2 Write property test: Template-Variablen-Ersetzung (Property 3)
    - **Property 3: Template-Variablen-Ersetzung und Dateiendung**
    - Generate arbitrary templates with `[Var]` placeholders and arbitrary variable values
    - Assert: every placeholder is replaced, all literals preserved, result ends with `.pdf`
    - **Validates: Requirements 5.2, 5.10**

  - [x] 2.3 Write property test: Template-Validierung bei fehlenden Variablen (Property 5)
    - **Property 5: Template-Validierung bei fehlenden Variablen**
    - Generate arbitrary strings that contain no `[...]` substring
    - Assert: `validateTemplate` returns a warning about identical filenames
    - **Validates: Requirements 5.8**

  - [x] 2.4 Write unit tests for TemplateEngine
    - Test `parseTemplate` with default template, empty template, template with only literals
    - Test `generateFilename` with special characters, missing variables, extra variables
    - Test `validateTemplate` with valid template, no-variable template, unknown variables
    - _Requirements: 5.1, 5.2, 5.7, 5.8, 5.9, 5.10_

- [x] 3. XLSX-Service (clientseitig)
  - [x] 3.1 Implement `XlsxService` in `client/src/services/xlsxService.ts`
    - Install SheetJS (`xlsx` package)
    - Implement `loadXlsx(file)` – parse XLSX file, extract headers, row count, raw data
    - Implement `readColumns(xlsxData, vornameColumn, nachnameColumn)` – map rows to `NameMapping[]` with `additionalFields`
    - Handle invalid XLSX format with descriptive error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.2 Write property test: XLSX-Namenszuordnung in Reihenfolge (Property 2)
    - **Property 2: XLSX-Namenszuordnung in Reihenfolge**
    - Generate arbitrary arrays of `{ vorname, nachname }` entries
    - Assert: `readColumns` maps row i to document i, preserving order and values
    - **Validates: Requirements 4.4**

  - [x] 3.3 Write property test: XLSX-Spaltenüberschriften als Template-Variablen (Property 4)
    - **Property 4: XLSX-Spaltenüberschriften als Template-Variablen**
    - Generate arbitrary lists of column header strings
    - Assert: `getAvailableVariables` includes each header as an available variable with source `'xlsx'`
    - **Validates: Requirements 4.2, 5.5**

  - [x] 3.4 Write unit tests for XlsxService
    - Test `loadXlsx` with valid XLSX buffer, invalid file format
    - Test `readColumns` with matching columns, missing columns, empty rows
    - Test row count mismatch detection
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 4. Checkpoint – Template-Engine und XLSX-Service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Backend: PDF-Services
  - [x] 5.1 Implement `PdfSplitService` in `server/src/services/pdfSplitService.ts`
    - Install `pdf-lib`
    - Implement `splitPdf(sourcePath, pagesPerDoc, outputDir, onProgress)` – load source PDF, copy page ranges into new PDFs, save to outputDir
    - Return `SplitResult[]` with index, filePath, pageRange, pageCount
    - Report progress via callback
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.2 Write property test: Aufteilungsberechnung (Property 1)
    - **Property 1: Aufteilungsberechnung**
    - Generate arbitrary `totalPages > 0` and `pagesPerDoc > 0`
    - Assert: number of documents = `Math.ceil(totalPages / pagesPerDoc)`, last doc has `totalPages % pagesPerDoc || pagesPerDoc` pages
    - **Validates: Requirements 2.2, 2.4**

  - [x] 5.3 Write property test: PDF-Split-Round-Trip (Property 7)
    - **Property 7: PDF-Split-Round-Trip**
    - Generate simple test PDFs with arbitrary page counts using pdf-lib
    - Split and then merge all resulting documents
    - Assert: merged document has same page count as original
    - **Validates: Requirements 8.4**

  - [x] 5.4 Implement `TextExtractionService` in `server/src/services/textExtractionService.ts`
    - Install `pdfjs-dist`
    - Implement `extractTextFromPage(pdfPath, pageIndex)` – load PDF, get text content from specified page
    - _Requirements: 3.1_

  - [x] 5.5 Implement `NameExtractionService` in `server/src/services/nameExtractionService.ts`
    - Implement `extractName(text)` – parse first lines for name patterns: `Vorname Nachname`, `Nachname, Vorname`, `Herr/Frau Vorname Nachname`
    - Return `ExtractedName` or `null` if no pattern matches
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.6 Implement `ThumbnailService` in `server/src/services/thumbnailService.ts`
    - Install `canvas` npm package
    - Implement `renderThumbnail(pdfPath, pageIndex, outputPath, scale)` – render first page as PNG using pdfjs-dist + canvas
    - _Requirements: 6.2_

  - [x] 5.7 Write unit tests for PDF services
    - Test `splitPdf` with a small test PDF (create programmatically with pdf-lib)
    - Test `extractTextFromPage` with a PDF containing known text
    - Test `extractName` with various name patterns and edge cases (empty text, no name found)
    - Test `renderThumbnail` produces a valid PNG file
    - _Requirements: 3.1, 3.2, 3.3, 8.1, 8.2_

- [x] 6. Backend: Session-Verwaltung und Cleanup
  - [x] 6.1 Implement `SessionStore` in `server/src/utils/sessionStore.ts`
    - In-memory Map-based session storage
    - Implement `createSession`, `getSession`, `updateSession`, `destroySession`
    - Implement `cleanupExpiredSessions(maxAgeMs)` – remove sessions older than maxAge, delete temp directories
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 6.2 Implement `CleanupService` in `server/src/services/cleanupService.ts`
    - Implement `destroySession` – recursively delete session temp directory
    - Set up periodic cleanup interval (every 5 minutes) for sessions older than 30 minutes
    - Trigger cleanup after successful download and on SSE disconnect
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 6.3 Implement temp directory utilities in `server/src/utils/tempDir.ts`
    - Create session-specific temp directories under `/tmp/slicepdf/{sessionId}/`
    - Create subdirectories `documents/` and `thumbnails/`
    - _Requirements: 9.1_

  - [x] 6.4 Write property test: Session-Cleanup (Property 8)
    - **Property 8: Session-Cleanup bereinigt alle temporären Dateien**
    - Create sessions with arbitrary files in temp directories
    - Call `destroySession` and assert the directory no longer exists
    - **Validates: Requirements 9.1, 9.2, 9.4**

  - [x] 6.5 Write unit tests for SessionStore and CleanupService
    - Test session lifecycle: create → get → update → destroy
    - Test `cleanupExpiredSessions` removes only expired sessions
    - Test temp directory creation and deletion
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 7. Checkpoint – Backend-Services
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Backend: REST-API-Routen und SSE
  - [x] 8.1 Implement Express server setup in `server/src/index.ts`
    - Configure Express with JSON body parser, CORS, static file serving
    - Set up Multer middleware in `server/src/middleware/uploadMiddleware.ts` (disk storage, 200 MB limit, PDF filter)
    - Set up session middleware in `server/src/middleware/sessionMiddleware.ts`
    - Mount all route handlers
    - _Requirements: 1.1, 1.3_

  - [x] 8.2 Implement `POST /api/upload` route in `server/src/routes/upload.ts`
    - Accept multipart PDF upload via Multer
    - Validate PDF format (check `%PDF-` magic bytes, attempt pdf-lib load)
    - Create session, store PDF in temp directory
    - Extract total page count with pdfjs-dist
    - Return `UploadResponse { sessionId, totalPages, filename }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 8.3 Implement `POST /api/process` route in `server/src/routes/process.ts`
    - Validate `sessionId` and `pagesPerDocument`
    - Orchestrate: call `PdfSplitService`, then `TextExtractionService` + `NameExtractionService` + `ThumbnailService` for each document
    - Send progress via SSE (see 8.4)
    - Return `ProcessResponse { jobId }`
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 8.1, 8.2, 8.3_

  - [x] 8.4 Implement `GET /api/progress/:jobId` SSE route in `server/src/routes/progress.ts`
    - Set up SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`)
    - Stream `ProgressEvent` objects during processing phases: `splitting`, `extracting`, `thumbnails`, `done`, `error`
    - On `done`: include `DocumentInfo[]` with extracted names, thumbnail URLs, page ranges
    - On client disconnect: trigger session cleanup
    - _Requirements: 3.1, 3.2, 3.3, 6.1_

  - [x] 8.5 Implement `POST /api/download` route in `server/src/routes/download.ts`
    - Accept `DownloadRequest` with document list and filenames
    - For `mode: 'zip'`: create ZIP with JSZip, stream as `application/zip`
    - For `mode: 'single'`: stream individual PDF as `application/pdf`
    - Trigger cleanup after successful download
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.6 Implement `GET /api/thumbnail/:sessionId/:docIndex` route and `DELETE /api/session/:sessionId` route
    - Thumbnail route: serve PNG from temp directory
    - Cleanup route: manually destroy session and return confirmation
    - _Requirements: 6.2, 9.1_

  - [x] 8.7 Write property test: ZIP-Dateinamen (Property 6)
    - **Property 6: ZIP-Dateinamen entsprechen generierten Namen**
    - Generate arbitrary lists of `{ index, filename }` documents
    - Create ZIP with JSZip using those filenames
    - Assert: ZIP entries match the generated filenames exactly
    - **Validates: Requirements 7.2**

  - [x] 8.8 Write unit tests for API routes
    - Test `POST /api/upload` with valid PDF, invalid file, oversized file
    - Test `POST /api/process` with valid session, invalid session, invalid pagesPerDoc
    - Test `POST /api/download` with valid documents, missing session
    - Test `DELETE /api/session/:sessionId` cleanup
    - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 9.1_

- [x] 9. Checkpoint – Backend komplett
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend: Upload-Komponenten
  - [x] 10.1 Implement `App` component with global state management in `client/src/App.tsx`
    - Set up `AppState` with React `useState` or `useReducer`
    - Define layout structure: `UploadPanel` → `ConfigPanel` → `PreviewPanel` → `DownloadPanel`
    - Implement step-based UI flow (upload → configure → preview → download)
    - _Requirements: All (UI foundation)_

  - [x] 10.2 Implement `PdfUploader` component in `client/src/components/PdfUploader.tsx`
    - File input with drag-and-drop, accept `.pdf` only
    - Call `POST /api/upload` on file selection
    - Display total page count and filename on success
    - Show error message for invalid files
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 10.3 Implement `XlsxUploader` component in `client/src/components/XlsxUploader.tsx`
    - File input accepting `.xlsx` files
    - Parse XLSX clientseitig with `XlsxService.loadXlsx()`
    - Display column headers for selection (Vorname/Nachname column pickers)
    - Show row count mismatch warning if applicable
    - Show error for invalid XLSX format
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

- [x] 11. Frontend: Konfigurations-Komponenten
  - [x] 11.1 Implement `PageCountInput` component in `client/src/components/PageCountInput.tsx`
    - Number input for pages per document
    - Calculate and display resulting document count: `Math.ceil(totalPages / pagesPerDoc)`
    - Validate: minimum 1, show error for invalid values
    - Show warning when pages don't divide evenly
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 11.2 Implement `TemplateEditor` component in `client/src/components/TemplateEditor.tsx`
    - Text input for filename template with default value `[Nachname], [Vorname]_[Dokument] - [Datum]`
    - `VariableChips` sub-component: clickable chips for all available variables (system + XLSX + custom)
    - Clicking a chip inserts the variable at cursor position
    - `DateFormatPicker` sub-component: dropdown for date format selection (DD.MM.YYYY, YYYY-MM-DD, etc.)
    - `LivePreview` sub-component: real-time filename preview using `TemplateEngine.generateFilename()`
    - Show warning when template has no variables
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9_

  - [x] 11.3 Implement `CustomVariableManager` component in `client/src/components/CustomVariableManager.tsx`
    - UI to add, edit, and remove custom variables (key + label + value)
    - Custom variables appear in `VariableChips` and are usable in template
    - _Requirements: 5.4_

- [x] 12. Frontend: Vorschau- und Download-Komponenten
  - [x] 12.1 Implement `PreviewPanel` with `ProcessingIndicator` in `client/src/components/PreviewPanel.tsx`
    - Connect to SSE endpoint `GET /api/progress/:jobId` via `EventSource`
    - Display progress bar with phase labels (Splitting, Extracting, Thumbnails)
    - Handle SSE errors and connection drops with retry/error message
    - _Requirements: 6.1_

  - [x] 12.2 Implement `DocumentList` and `DocumentCard` components in `client/src/components/DocumentList.tsx`
    - Render list of all target documents after processing completes
    - Each `DocumentCard` shows: thumbnail image (from `/api/thumbnail/`), generated filename, editable Vorname/Nachname fields
    - Highlight documents with failed name extraction (visual distinction, "Name nicht erkannt")
    - On name edit: immediately recalculate filename via `TemplateEngine.generateFilename()`
    - Apply XLSX names when available (override extracted names)
    - _Requirements: 3.3, 3.4, 6.1, 6.2, 6.3, 6.4_

  - [x] 12.3 Implement `DownloadPanel` with `ZipDownloadButton` and `SingleDownloadButton` in `client/src/components/DownloadPanel.tsx`
    - `ZipDownloadButton`: call `POST /api/download` with mode `'zip'` and all document filenames, trigger browser download
    - `SingleDownloadButton` on each `DocumentCard`: call `POST /api/download` with mode `'single'`
    - Show confirmation message after successful download
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 13. Checkpoint – Frontend komplett
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Integration und Feinschliff
  - [x] 14.1 Wire frontend to backend end-to-end
    - Configure Vite proxy for API calls during development
    - Test complete flow: PDF upload → page count config → process → SSE progress → preview → name edit → download ZIP
    - Ensure XLSX upload → column selection → name override works in preview
    - Ensure template changes reflect in live preview and final filenames
    - _Requirements: All_

  - [x] 14.2 Implement cleanup triggers on frontend side
    - Call `DELETE /api/session/:sessionId` on page unload (`beforeunload` event)
    - Handle session expiry gracefully (show "Session abgelaufen" message on 404)
    - _Requirements: 9.1, 9.4_

  - [x] 14.3 Write integration tests
    - Test PDF upload → process → SSE → preview → download flow (API-level)
    - Test XLSX parsing → column mapping → name assignment
    - Test session lifecycle: upload → process → download → cleanup (verify temp dir deleted)
    - _Requirements: All_

- [x] 15. Final Checkpoint – Alle Tests bestanden
  - Ensure all tests pass, ask the user if questions arise.

## Hinweise

- Tasks mit `*` sind optional und können für ein schnelleres MVP übersprungen werden
- Jeder Task referenziert spezifische Anforderungen für Nachverfolgbarkeit
- Checkpoints stellen inkrementelle Validierung sicher
- Property-Tests validieren die 8 universellen Korrektheitseigenschaften aus dem Design
- Unit-Tests validieren spezifische Beispiele und Edge-Cases
- Die Template-Engine und der XLSX-Service laufen clientseitig, alle PDF-Verarbeitung serverseitig
