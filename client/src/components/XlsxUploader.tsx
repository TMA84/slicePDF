import { useState, useRef } from 'react';
import type { XlsxState, XlsxInfo } from '../types';
import { loadXlsx, readColumns } from '../services/xlsxService';

interface XlsxUploaderProps {
  onLoaded: (data: XlsxState) => void;
}

export default function XlsxUploader({ onLoaded }: XlsxUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [xlsxInfo, setXlsxInfo] = useState<XlsxInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [vornameColumn, setVornameColumn] = useState<string | null>(null);
  const [nachnameColumn, setNachnameColumn] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;

    setError(null);
    setXlsxInfo(null);
    setFile(null);
    setVornameColumn(null);
    setNachnameColumn(null);

    try {
      const info = await loadXlsx(selected);
      setXlsxInfo(info);
      setFile(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.');
    }
  };

  const handleVornameChange = (value: string) => {
    const col = value || null;
    setVornameColumn(col);
    if (col && nachnameColumn && xlsxInfo && file) {
      emitResult(file, xlsxInfo, col, nachnameColumn);
    }
  };

  const handleNachnameChange = (value: string) => {
    const col = value || null;
    setNachnameColumn(col);
    if (vornameColumn && col && xlsxInfo && file) {
      emitResult(file, xlsxInfo, vornameColumn, col);
    }
  };

  const emitResult = (f: File, info: XlsxInfo, vorCol: string, nachCol: string) => {
    try {
      const mappings = readColumns(info, vorCol, nachCol);
      onLoaded({
        file: f,
        info,
        vornameColumn: vorCol,
        nachnameColumn: nachCol,
        mappings,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Lesen der Spalten.');
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        onChange={handleFileChange}
        className="hidden"
        data-testid="xlsx-file-input"
      />

      {!xlsxInfo && (
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
          className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            error
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          {error ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="h-8 w-8 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm font-medium text-red-600">{error}</p>
              <p className="mt-1 text-xs text-red-500">Klicken, um es erneut zu versuchen</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="h-10 w-10 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125M12 18.375h-7.5" />
              </svg>
              <p className="text-sm font-medium text-gray-600">XLSX-Namensdatei hochladen (optional)</p>
              <p className="text-xs text-gray-400">Nur .xlsx-Dateien werden akzeptiert</p>
            </div>
          )}
        </div>
      )}

      {xlsxInfo && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {file?.name}
              </p>
              <p className="text-xs text-gray-500">
                {xlsxInfo.rowCount} Datenzeilen · Blatt: {xlsxInfo.sheetName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setXlsxInfo(null);
                setFile(null);
                setVornameColumn(null);
                setNachnameColumn(null);
                setError(null);
              }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Entfernen
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="vorname-column" className="block text-sm font-medium text-gray-700 mb-1">
                Vorname-Spalte
              </label>
              <select
                id="vorname-column"
                value={vornameColumn ?? ''}
                onChange={(e) => handleVornameChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">– Spalte wählen –</option>
                {xlsxInfo.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nachname-column" className="block text-sm font-medium text-gray-700 mb-1">
                Nachname-Spalte
              </label>
              <select
                id="nachname-column"
                value={nachnameColumn ?? ''}
                onChange={(e) => handleNachnameChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">– Spalte wählen –</option>
                {xlsxInfo.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
