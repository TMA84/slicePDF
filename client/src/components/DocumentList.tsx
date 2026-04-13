import type { DocumentState, CustomVariable } from '../types';

// --- DocumentCard ---

interface DocumentCardProps {
  doc: DocumentState;
  onUpdate: (updated: DocumentState) => void;
}

function DocumentCard({ doc, onUpdate }: DocumentCardProps) {
  const handleVornameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...doc, vorname: e.target.value, nameSource: 'manual' });
  };

  const handleNachnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...doc, nachname: e.target.value, nameSource: 'manual' });
  };

  const borderClass = doc.extractionFailed
    ? 'border-amber-400 bg-amber-50'
    : 'border-gray-200 bg-white';

  return (
    <div className={`rounded-lg border-2 p-3 ${borderClass}`}>
      {doc.extractionFailed && (
        <span className="mb-2 inline-block rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
          Name nicht erkannt
        </span>
      )}

      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {doc.thumbnailUrl ? (
            <img
              src={doc.thumbnailUrl}
              alt={`Vorschau Dokument ${doc.index + 1}`}
              className="h-24 w-auto rounded border border-gray-300 object-contain"
            />
          ) : (
            <div className="flex h-24 w-16 items-center justify-center rounded border border-gray-300 bg-gray-100 text-xs text-gray-400">
              PDF
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <p className="truncate text-sm font-medium text-gray-800" title={doc.generatedFilename}>
            {doc.generatedFilename || `document-${doc.index + 1}.pdf`}
          </p>
          <p className="text-xs text-gray-500">
            Seiten {doc.pageRange.start + 1}–{doc.pageRange.end + 1}
          </p>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-xs text-gray-500">Vorname</span>
              <input
                type="text"
                value={doc.vorname}
                onChange={handleVornameChange}
                className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Vorname"
              />
            </label>
            <label className="flex-1">
              <span className="text-xs text-gray-500">Nachname</span>
              <input
                type="text"
                value={doc.nachname}
                onChange={handleNachnameChange}
                className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Nachname"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- DocumentList ---

interface DocumentListProps {
  documents: DocumentState[];
  filenameTemplate: string;
  dateFormat: string;
  customVariables: CustomVariable[];
  onDocumentsChange: (docs: DocumentState[]) => void;
}

export default function DocumentList({
  documents,
  onDocumentsChange,
}: DocumentListProps) {
  const handleDocumentUpdate = (updated: DocumentState) => {
    const next = documents.map((d) => (d.index === updated.index ? updated : d));
    onDocumentsChange(next);
  };

  const failedCount = documents.filter((d) => d.extractionFailed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          {documents.length} Dokument{documents.length !== 1 ? 'e' : ''}
        </p>
        {failedCount > 0 && (
          <span className="text-xs text-amber-700">
            {failedCount} ohne erkannten Namen
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.index}
            doc={doc}
            onUpdate={handleDocumentUpdate}
          />
        ))}
      </div>
    </div>
  );
}
