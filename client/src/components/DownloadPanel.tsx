import { useState } from 'react';
import type { DocumentState } from '../types';

interface DownloadPanelProps {
  sessionId: string | null;
  documents: DocumentState[];
  onSessionExpired?: () => void;
  onReset?: () => void;
}

type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

export default function DownloadPanel({ sessionId, documents, onSessionExpired, onReset }: DownloadPanelProps) {
  const [zipStatus, setZipStatus] = useState<DownloadStatus>('idle');
  const [singleStatus, setSingleStatus] = useState<Record<number, DownloadStatus>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const triggerBrowserDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleZipDownload = async () => {
    if (!sessionId || documents.length === 0) return;

    setZipStatus('downloading');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          documents: documents.map((doc) => ({
            index: doc.index,
            filename: doc.generatedFilename || `document-${doc.index}.pdf`,
          })),
          mode: 'zip',
        }),
      });

      if (!res.ok) {
        if (res.status === 404 && onSessionExpired) {
          onSessionExpired();
          return;
        }
        const err = await res.json().catch(() => ({ error: 'Download fehlgeschlagen.' }));
        throw new Error(err.error ?? 'Download fehlgeschlagen.');
      }

      const blob = await res.blob();
      triggerBrowserDownload(blob, 'documents.zip');
      setZipStatus('success');

      // Reset the app after a short delay so the user sees the success message
      if (onReset) {
        setTimeout(() => onReset(), 2000);
      }
    } catch (err) {
      setZipStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Download fehlgeschlagen.');
    }
  };

  const handleSingleDownload = async (doc: DocumentState) => {
    if (!sessionId) return;

    setSingleStatus((prev) => ({ ...prev, [doc.index]: 'downloading' }));
    setErrorMessage(null);

    try {
      const filename = doc.generatedFilename || `document-${doc.index}.pdf`;
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          documents: [{ index: doc.index, filename }],
          mode: 'single',
          singleIndex: doc.index,
        }),
      });

      if (!res.ok) {
        if (res.status === 404 && onSessionExpired) {
          onSessionExpired();
          return;
        }
        const err = await res.json().catch(() => ({ error: 'Download fehlgeschlagen.' }));
        throw new Error(err.error ?? 'Download fehlgeschlagen.');
      }

      const blob = await res.blob();
      triggerBrowserDownload(blob, filename);
      setSingleStatus((prev) => ({ ...prev, [doc.index]: 'success' }));
    } catch (err) {
      setSingleStatus((prev) => ({ ...prev, [doc.index]: 'error' }));
      setErrorMessage(err instanceof Error ? err.message : 'Download fehlgeschlagen.');
    }
  };

  return (
    <div className="space-y-5">
      {/* ZIP Download */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Alle Dokumente herunterladen</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {documents.length} Dokument{documents.length !== 1 ? 'e' : ''} als ZIP-Archiv
            </p>
          </div>
          <button
            type="button"
            onClick={handleZipDownload}
            disabled={zipStatus === 'downloading' || !sessionId || documents.length === 0}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 shadow-md shadow-brand-200 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {zipStatus === 'downloading' ? 'Downloading…' : 'ZIP herunterladen'}
          </button>
        </div>

        {zipStatus === 'success' && (
          <p className="mt-3 text-sm text-emerald-600 font-medium flex items-center gap-1">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-xs">✓</span>
            Download abgeschlossen
          </p>
        )}
        {zipStatus === 'error' && errorMessage && (
          <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
        )}
      </div>

      {/* Single Document Downloads */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Einzelne Dokumente</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {documents.map((doc) => {
            const status = singleStatus[doc.index] ?? 'idle';
            return (
              <div
                key={doc.index}
                className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <span className="text-sm text-gray-700 truncate mr-2">
                  {doc.generatedFilename || `document-${doc.index}.pdf`}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {status === 'success' && (
                    <span className="text-xs text-green-600">✓</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSingleDownload(doc)}
                    disabled={status === 'downloading' || !sessionId}
                    className="rounded bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'downloading' ? '…' : 'PDF'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
