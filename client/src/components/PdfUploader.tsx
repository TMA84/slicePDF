import { useState, useRef, useCallback } from 'react';
import type { SourcePdfState } from '../types';

interface PdfUploaderProps {
  onUploaded: (session: { sessionId: string; pdf: SourcePdfState }) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function PdfUploader({ onUploaded }: PdfUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedInfo, setUploadedInfo] = useState<{ filename: string; totalPages: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('error');
      setError('Bitte wählen Sie eine gültige PDF-Datei aus (.pdf).');
      return;
    }

    setStatus('uploading');
    setError(null);
    setUploadedInfo(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Upload fehlgeschlagen (Status ${response.status})`;
        throw new Error(message);
      }

      const data = await response.json();
      const { sessionId, totalPages, filename } = data;

      setStatus('success');
      setUploadedInfo({ filename, totalPages });
      onUploaded({
        sessionId,
        pdf: { filename, totalPages, fileSize: file.size },
      });
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.');
    }
  }, [onUploaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
        data-testid="pdf-file-input"
      />

      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-brand-400 bg-brand-50 shadow-lg shadow-brand-100'
            : status === 'error'
              ? 'border-red-300 bg-red-50'
              : status === 'success'
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50/30 hover:shadow-md'
        }`}
      >
        {status === 'uploading' && (
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-blue-600">PDF wird hochgeladen…</p>
          </div>
        )}

        {status === 'success' && uploadedInfo && (
          <div className="flex flex-col items-center gap-1">
            <svg className="h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-700">{uploadedInfo.filename}</p>
            <p className="text-xs text-green-600">{uploadedInfo.totalPages} Seiten</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm font-medium text-red-600">{error}</p>
            <p className="mt-1 text-xs text-red-500">Klicken oder Datei hierher ziehen, um es erneut zu versuchen</p>
          </div>
        )}

        {status === 'idle' && (
          <div className="flex flex-col items-center gap-2">
            <svg className="h-10 w-10 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm font-medium text-gray-600">PDF-Datei hierher ziehen oder klicken</p>
            <p className="text-xs text-gray-400">Nur .pdf-Dateien werden akzeptiert</p>
          </div>
        )}
      </div>
    </div>
  );
}
