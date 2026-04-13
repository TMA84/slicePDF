import { useState } from 'react';

interface PageCountInputProps {
  totalPages: number;
  pagesPerDocument: number;
  onChange: (value: number) => void;
  onStartProcessing: () => void;
  isProcessing?: boolean;
  isDone?: boolean;
  sessionId: string | null;
}

export default function PageCountInput({
  totalPages,
  pagesPerDocument,
  onChange,
  onStartProcessing,
  isProcessing = false,
  isDone = false,
  sessionId,
}: PageCountInputProps) {
  const [touched, setTouched] = useState(false);

  const isValid = pagesPerDocument >= 1;
  const showError = touched && !isValid;
  const documentCount = isValid && totalPages > 0
    ? Math.ceil(totalPages / pagesPerDocument)
    : 0;
  const remainder = isValid && totalPages > 0
    ? totalPages % pagesPerDocument
    : 0;
  const showWarning = isValid && totalPages > 0 && remainder !== 0;
  const lastDocPages = remainder || pagesPerDocument;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = parseInt(raw, 10);
    setTouched(true);
    onChange(isNaN(num) ? 0 : num);
  };

  const canProcess = isValid && totalPages > 0 && !!sessionId && !isProcessing;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
      <div>
        <label
          htmlFor="pagesPerDocument"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Seitenanzahl pro Dokument
        </label>
        <input
          id="pagesPerDocument"
          type="number"
          min={1}
          value={pagesPerDocument}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
            showError
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
          aria-invalid={showError}
          aria-describedby={
            showError ? 'page-count-error' : showWarning ? 'page-count-warning' : undefined
          }
        />
      </div>

      {showError && (
        <p id="page-count-error" className="text-sm text-red-600" role="alert">
          Bitte geben Sie eine Seitenanzahl von mindestens 1 ein.
        </p>
      )}

      {isValid && totalPages > 0 && (
        <p className="text-sm text-gray-600">
          Ergebnis: <span className="font-semibold">{documentCount}</span>{' '}
          {documentCount === 1 ? 'Dokument' : 'Dokumente'}
        </p>
      )}

      {showWarning && (
        <p id="page-count-warning" className="text-sm text-amber-600" role="status">
          Die Gesamtseitenzahl ist nicht gleichmäßig teilbar. Das letzte Dokument
          enthält {lastDocPages} Seiten.
        </p>
      )}

      {!isDone && (
        <button
          type="button"
          onClick={onStartProcessing}
          disabled={!canProcess}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all ${
            canProcess
              ? 'bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-200 hover:shadow-lg hover:shadow-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-500'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isProcessing ? 'Verarbeitung läuft…' : 'Verarbeitung starten'}
        </button>
      )}
    </div>
  );
}
