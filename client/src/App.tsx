import { useState, useEffect } from 'react';
import type {
  AppState,
  SourcePdfState,
  XlsxState,
  ProcessingState,
  DocumentState,
  CustomVariable,
  TemplateVariables,
} from './types';
import { DEFAULT_TEMPLATE, generateFilename } from './services/templateEngine';
import PdfUploader from './components/PdfUploader';
import XlsxUploader from './components/XlsxUploader';
import PageCountInput from './components/PageCountInput';
import TemplateEditor from './components/TemplateEditor';
import CustomVariableManager from './components/CustomVariableManager';
import PreviewPanel from './components/PreviewPanel';
import DownloadPanel from './components/DownloadPanel';

// --- Step helpers ---

type Step = 'upload' | 'configure' | 'download';

function getActiveStep(state: AppState): Step {
  if (state.processing.status === 'done' && state.documents.length > 0) {
    // Stay in configure until user explicitly navigates to download
    return state.showDownload ? 'download' : 'configure';
  }
  if (
    state.processing.status !== 'idle' &&
    state.processing.status !== 'uploading' &&
    state.processing.status !== 'done' &&
    state.processing.status !== 'error'
  ) {
    return 'configure'; // Stay in configure during processing too
  }
  if (state.sourcePdf) {
    return 'configure';
  }
  return 'upload';
}

const STEP_LABELS: Record<Step, { number: number; label: string }> = {
  upload: { number: 1, label: 'Hochladen' },
  configure: { number: 2, label: 'Konfigurieren & Vorschau' },
  download: { number: 3, label: 'Herunterladen' },
};

const STEPS: Step[] = ['upload', 'configure', 'download'];

function StepIndicator({ activeStep }: { activeStep: Step }) {
  const activeIndex = STEPS.indexOf(activeStep);

  return (
    <nav className="flex items-center justify-center gap-3 mb-10">
      {STEPS.map((step, i) => {
        const { number, label } = STEP_LABELS[step];
        const isActive = step === activeStep;
        const isCompleted = i < activeIndex;

        return (
          <div key={step} className="flex items-center gap-3">
            {i > 0 && (
              <div
                className={`h-px w-12 transition-colors duration-300 ${
                  isCompleted ? 'bg-brand-400' : 'bg-gray-200'
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                    : isCompleted
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? '✓' : number}
              </span>
              <span
                className={`text-sm transition-colors duration-300 ${
                  isActive
                    ? 'font-semibold text-brand-700'
                    : isCompleted
                      ? 'font-medium text-brand-500'
                      : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// --- Initial state ---

const INITIAL_PROCESSING: ProcessingState = {
  status: 'idle',
  progress: 0,
  currentDoc: null,
  totalDocs: null,
  message: null,
  error: null,
};

const INITIAL_STATE: AppState = {
  sessionId: null,
  sourcePdf: null,
  xlsxData: null,
  pagesPerDocument: 1,
  filenameTemplate: DEFAULT_TEMPLATE,
  dateFormat: 'DD.MM.YYYY',
  dokumentName: '',
  customVariables: [],
  processing: INITIAL_PROCESSING,
  documents: [],
  showDownload: false,
};

// --- App component ---

// Build template variables for a document (shared logic with DocumentList)
function buildTemplateVariables(
  doc: DocumentState,
  dateFormat: string,
  dokumentName: string,
  customVariables: CustomVariable[],
  totalDocuments: number,
): TemplateVariables {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());

  let datum: string;
  switch (dateFormat) {
    case 'YYYY-MM-DD':
      datum = `${yyyy}-${mm}-${dd}`;
      break;
    case 'DDMMYYYY':
      datum = `${dd}${mm}${yyyy}`;
      break;
    default:
      datum = `${dd}.${mm}.${yyyy}`;
      break;
  }

  // Pad the number based on total document count
  const padLength = Math.max(1, String(totalDocuments).length);
  const nummerStr = String(doc.index + 1).padStart(padLength, '0');

  const vars: TemplateVariables = {
    nachname: doc.nachname,
    vorname: doc.vorname,
    dokument: dokumentName,
    datum,
    nummer: nummerStr,
  };

  for (const cv of customVariables) {
    vars[cv.key.toLowerCase()] = cv.value;
  }

  return vars;
}

function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const activeStep = getActiveStep(state);

  // Cleanup session on page unload (Requirement 9.1, 9.4)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sid = state.sessionId;
      if (sid) {
        fetch(`/api/session/${sid}`, { method: 'DELETE', keepalive: true });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.sessionId]);

  // Helper: reset to initial state with session-expired message
  const handleSessionExpired = () => {
    setState({
      ...INITIAL_STATE,
      processing: {
        ...INITIAL_PROCESSING,
        status: 'error',
        error: 'Session abgelaufen. Bitte laden Sie die PDF-Datei erneut hoch.',
      },
    });
  };

  // Keep generatedFilename in sync with template, dateFormat, customVariables, and document names.
  // Also apply XLSX name overrides when available.
  useEffect(() => {
    if (state.documents.length === 0) return;

    const updated = state.documents.map((doc, i) => {
      let vorname = doc.vorname;
      let nachname = doc.nachname;
      let nameSource = doc.nameSource;

      // Apply XLSX overrides if available
      const mapping = state.xlsxData?.mappings[i];
      if (mapping && (mapping.vorname || mapping.nachname)) {
        vorname = mapping.vorname;
        nachname = mapping.nachname;
        nameSource = 'xlsx';
      }

      const docWithNames = { ...doc, vorname, nachname, nameSource };
      const vars = buildTemplateVariables(docWithNames, state.dateFormat, state.dokumentName, state.customVariables, state.documents.length);

      // Add XLSX additional fields as variables
      if (mapping) {
        for (const [key, value] of Object.entries(mapping.additionalFields)) {
          vars[key.toLowerCase()] = value;
        }
      }

      const generatedFilename = generateFilename(state.filenameTemplate, vars);

      return { ...docWithNames, generatedFilename };
    });

    // Only update if something actually changed to avoid infinite loops
    const hasChanges = updated.some(
      (doc, i) => {
        const prev = state.documents[i];
        if (!prev) return true;
        return (
          doc.generatedFilename !== prev.generatedFilename ||
          doc.vorname !== prev.vorname ||
          doc.nachname !== prev.nachname ||
          doc.nameSource !== prev.nameSource
        );
      },
    );

    if (hasChanges) {
      setState((prev) => ({ ...prev, documents: updated }));
    }
  }, [
    state.documents,
    state.filenameTemplate,
    state.dateFormat,
    state.dokumentName,
    state.customVariables,
    state.xlsxData,
  ]);

  // --- State updaters ---

  const handlePdfUploaded = (session: { sessionId: string; pdf: SourcePdfState }) => {
    setState((prev) => ({
      ...prev,
      sessionId: session.sessionId,
      sourcePdf: session.pdf,
    }));
  };

  const handleXlsxLoaded = (data: XlsxState) => {
    setState((prev) => ({ ...prev, xlsxData: data }));
  };

  const handlePagesPerDocumentChange = (value: number) => {
    setState((prev) => ({
      ...prev,
      pagesPerDocument: value,
      // Reset processing so the user can re-process with the new page count
      processing: INITIAL_PROCESSING,
      documents: [],
      showDownload: false,
    }));
  };

  const handleTemplateChange = (value: string) => {
    setState((prev) => ({ ...prev, filenameTemplate: value }));
  };

  const handleDateFormatChange = (value: string) => {
    setState((prev) => ({ ...prev, dateFormat: value }));
  };

  const handleDokumentNameChange = (value: string) => {
    setState((prev) => ({ ...prev, dokumentName: value }));
  };

  const handleCustomVariablesChange = (vars: CustomVariable[]) => {
    setState((prev) => ({ ...prev, customVariables: vars }));
  };

  const handleDocumentsChange = (documents: DocumentState[]) => {
    setState((prev) => ({ ...prev, documents }));
  };

  const handleStartProcessing = async () => {
    if (!state.sessionId || state.pagesPerDocument < 1) return;

    setState((prev) => ({
      ...prev,
      processing: { ...INITIAL_PROCESSING, status: 'splitting', progress: 0, message: 'Verarbeitung wird gestartet…' },
      documents: [],
    }));

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          pagesPerDocument: state.pagesPerDocument,
          extractNames: true,
        }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          handleSessionExpired();
          return;
        }
        const err = await res.json().catch(() => ({ error: 'Verarbeitung fehlgeschlagen.' }));
        setState((prev) => ({
          ...prev,
          processing: { ...INITIAL_PROCESSING, status: 'error', error: err.error ?? 'Verarbeitung fehlgeschlagen.' },
        }));
        return;
      }

      const { jobId } = await res.json();

      // Connect to SSE for progress updates
      const evtSource = new EventSource(`/api/progress/${jobId}`);

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.phase === 'done') {
            evtSource.close();
            const docs: DocumentState[] = (data.documents ?? []).map((doc: { index: number; pageRange: { start: number; end: number }; extractedName: { vorname: string; nachname: string; raw: string } | null; extractionFailed: boolean; thumbnailUrl: string }) => ({
              index: doc.index,
              pageRange: doc.pageRange,
              extractedName: doc.extractedName,
              nameSource: doc.extractedName ? 'extracted' as const : 'manual' as const,
              extractionFailed: doc.extractionFailed,
              vorname: doc.extractedName?.vorname ?? '',
              nachname: doc.extractedName?.nachname ?? '',
              thumbnailUrl: doc.thumbnailUrl ?? null,
              generatedFilename: '',
            }));
            setState((prev) => ({
              ...prev,
              processing: { ...INITIAL_PROCESSING, status: 'done', progress: 100 },
              documents: docs,
            }));
            return;
          }

          if (data.phase === 'error') {
            evtSource.close();
            setState((prev) => ({
              ...prev,
              processing: { ...INITIAL_PROCESSING, status: 'error', error: data.message ?? 'Verarbeitung fehlgeschlagen.' },
            }));
            return;
          }

          setState((prev) => ({
            ...prev,
            processing: {
              ...prev.processing,
              status: data.phase ?? prev.processing.status,
              progress: data.progress ?? prev.processing.progress,
              currentDoc: data.currentDoc ?? prev.processing.currentDoc,
              totalDocs: data.totalDocs ?? prev.processing.totalDocs,
              message: data.message ?? prev.processing.message,
            },
          }));
        } catch {
          // ignore malformed SSE data
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        setState((prev) => ({
          ...prev,
          processing: {
            ...prev.processing,
            status: 'error',
            error: 'Verbindung zum Server unterbrochen. Bitte versuchen Sie es erneut.',
          },
        }));
      };
    } catch {
      setState((prev) => ({
        ...prev,
        processing: { ...INITIAL_PROCESSING, status: 'error', error: 'Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung.' },
      }));
    }
  };

  // Navigate back to a previous step by resetting relevant state
  const handleBackToUpload = () => {
    setState(INITIAL_STATE);
  };

  const handleBackToConfigure = () => {
    setState((prev) => ({
      ...prev,
      processing: INITIAL_PROCESSING,
      documents: [],
      showDownload: false,
    }));
  };

  const handleGoToDownload = () => {
    setState((prev) => ({ ...prev, showDownload: true }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-lg px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-md shadow-brand-200">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">slicePDF</h1>
            <p className="text-xs text-gray-400 -mt-0.5">PDF-Serienbrief-Splitter</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <StepIndicator activeStep={activeStep} />

        {/* Step 1: Upload */}
        {activeStep === 'upload' && (
          <section className="space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                PDF-Datei hochladen
              </h2>
              <p className="text-sm text-gray-500 mt-1">Laden Sie Ihren Serienbrief als PDF hoch</p>
            </div>
            <PdfUploader onUploaded={handlePdfUploaded} />
            <XlsxUploader onLoaded={handleXlsxLoaded} />
          </section>
        )}

        {/* Step 2: Configure */}
        {activeStep === 'configure' && (
          <section className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Konfiguration
              </h2>
              <button
                type="button"
                onClick={handleBackToUpload}
                className="text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
              >
                ← Zurück
              </button>
            </div>

            {state.sourcePdf && (
              <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-sm text-brand-800 flex items-center gap-2">
                <svg className="h-4 w-4 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="font-semibold">{state.sourcePdf.filename}</span>
                <span className="text-brand-500">·</span>
                <span>{state.sourcePdf.totalPages} Seiten</span>
              </div>
            )}

            <PageCountInput
              totalPages={state.sourcePdf?.totalPages ?? 0}
              pagesPerDocument={state.pagesPerDocument}
              onChange={handlePagesPerDocumentChange}
              onStartProcessing={handleStartProcessing}
              isProcessing={state.processing.status !== 'idle' && state.processing.status !== 'error' && state.processing.status !== 'done'}
              isDone={state.processing.status === 'done' && state.documents.length > 0}
              sessionId={state.sessionId}
            />

            {/* Inline processing indicator */}
            {(state.processing.status === 'splitting' || state.processing.status === 'extracting' || state.processing.status === 'thumbnails') && (
              <PreviewPanel
                processing={state.processing}
                documents={state.documents}
                sessionId={state.sessionId}
                filenameTemplate={state.filenameTemplate}
                dateFormat={state.dateFormat}
                customVariables={state.customVariables}
                onDocumentsChange={handleDocumentsChange}
              />
            )}

            {/* Show recognized names after processing */}
            {state.processing.status === 'done' && state.documents.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5 space-y-4 animate-slide-up">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-xs">✓</span>
                    {state.documents.length} Dokument{state.documents.length !== 1 ? 'e' : ''} erkannt
                  </h3>
                  {state.documents.some(d => d.extractionFailed) && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                      {state.documents.filter(d => d.extractionFailed).length} ohne Namen
                    </span>
                  )}
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg bg-white/60 p-2">
                  {state.documents.map((doc) => (
                    <div
                      key={doc.index}
                      className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        doc.extractionFailed
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-white text-gray-700 border border-gray-100'
                      }`}
                    >
                      <span className="font-mono text-xs text-gray-300 mr-3 tabular-nums">
                        {String(doc.index + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {doc.vorname || doc.nachname
                          ? `${doc.vorname} ${doc.nachname}`.trim()
                          : 'Name nicht erkannt'}
                      </span>
                      <span className="text-xs text-gray-400 ml-3 tabular-nums">
                        S. {doc.pageRange.start + 1}–{doc.pageRange.end + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.processing.status === 'error' && state.processing.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2 animate-fade-in">
                <svg className="h-4 w-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {state.processing.error}
              </div>
            )}

            <TemplateEditor
              template={state.filenameTemplate}
              onTemplateChange={handleTemplateChange}
              dateFormat={state.dateFormat}
              onDateFormatChange={handleDateFormatChange}
              dokumentName={state.dokumentName}
              onDokumentNameChange={handleDokumentNameChange}
              customVariables={state.customVariables}
              xlsxHeaders={state.xlsxData?.info.headers ?? []}
              previewDocument={state.documents[0] ? { vorname: state.documents[0].vorname, nachname: state.documents[0].nachname } : null}
            />

            <CustomVariableManager
              variables={state.customVariables}
              onChange={handleCustomVariablesChange}
            />

            {/* XLSX upload is also available in configure step */}
            {!state.xlsxData && (
              <XlsxUploader onLoaded={handleXlsxLoaded} />
            )}

            {/* "Weiter zum Download" button — shown after processing is done */}
            {state.processing.status === 'done' && state.documents.length > 0 && (
              <button
                type="button"
                onClick={handleGoToDownload}
                className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 shadow-md shadow-brand-200 transition-all hover:shadow-lg hover:shadow-brand-200"
              >
                Weiter zum Download →
              </button>
            )}
          </section>
        )}

        {/* Step 3: Download */}
        {activeStep === 'download' && (
          <section className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Herunterladen
              </h2>
              <button
                type="button"
                onClick={handleBackToConfigure}
                className="text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
              >
                ← Zurück
              </button>
            </div>

            <PreviewPanel
              processing={state.processing}
              documents={state.documents}
              sessionId={state.sessionId}
              filenameTemplate={state.filenameTemplate}
              dateFormat={state.dateFormat}
              customVariables={state.customVariables}
              onDocumentsChange={handleDocumentsChange}
            />

            <DownloadPanel
              sessionId={state.sessionId}
              documents={state.documents}
              onSessionExpired={handleSessionExpired}
              onReset={handleBackToUpload}
            />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
