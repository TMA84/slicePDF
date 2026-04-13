import type { ProcessingState, DocumentState, CustomVariable } from '../types';
import DocumentList from './DocumentList';

// --- ProcessingIndicator sub-component ---

const PHASE_LABELS: Record<string, string> = {
  uploading: 'Datei wird hochgeladen…',
  splitting: 'PDF wird aufgeteilt…',
  extracting: 'Namen werden extrahiert…',
  thumbnails: 'Vorschau wird erstellt…',
};

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-brand-600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function ProcessingIndicator({ processing }: { processing: ProcessingState }) {
  if (processing.status === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-red-600 text-lg" aria-hidden="true">⚠</span>
          <p className="text-sm font-medium text-red-800">Fehler bei der Verarbeitung</p>
        </div>
        {processing.error && (
          <p className="mt-2 text-sm text-red-700">{processing.error}</p>
        )}
      </div>
    );
  }

  const phaseLabel = PHASE_LABELS[processing.status] ?? processing.message ?? 'Verarbeitung läuft…';
  const progress = Math.min(Math.max(processing.progress, 0), 100);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      {/* Phase label + spinner */}
      <div className="flex items-center gap-2">
        <Spinner />
        <span className="text-sm font-medium text-gray-700">{phaseLabel}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="bg-brand-500 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Progress details */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{Math.round(progress)}%</span>
        {processing.currentDoc != null && processing.totalDocs != null && (
          <span>
            Dokument {processing.currentDoc + 1} von {processing.totalDocs}
          </span>
        )}
      </div>
    </div>
  );
}

// --- PreviewPanel ---

interface PreviewPanelProps {
  processing: ProcessingState;
  documents: DocumentState[];
  sessionId: string | null;
  filenameTemplate: string;
  dateFormat: string;
  customVariables: CustomVariable[];
  onDocumentsChange: (docs: DocumentState[]) => void;
}

export default function PreviewPanel({
  processing,
  documents,
  filenameTemplate,
  dateFormat,
  customVariables,
  onDocumentsChange,
}: PreviewPanelProps) {
  const isProcessing =
    processing.status === 'splitting' ||
    processing.status === 'extracting' ||
    processing.status === 'thumbnails' ||
    processing.status === 'uploading';

  if (isProcessing || processing.status === 'error') {
    return <ProcessingIndicator processing={processing} />;
  }

  if (processing.status === 'done' && documents.length > 0) {
    return (
      <DocumentList
        documents={documents}
        filenameTemplate={filenameTemplate}
        dateFormat={dateFormat}
        customVariables={customVariables}
        onDocumentsChange={onDocumentsChange}
      />
    );
  }

  return null;
}
