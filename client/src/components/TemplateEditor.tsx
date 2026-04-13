import { useRef } from 'react';
import type { CustomVariable } from '../types';
import {
  getAvailableVariables,
  validateTemplate,
  parseTemplate,
} from '../services/templateEngine';
import type { VariableDefinition, TemplateVariables } from '../types';

export interface TemplateEditorProps {
  template: string;
  onTemplateChange: (value: string) => void;
  dateFormat: string;
  onDateFormatChange: (value: string) => void;
  dokumentName: string;
  onDokumentNameChange: (value: string) => void;
  customVariables: CustomVariable[];
  xlsxHeaders: string[];
  /** First document's data for realistic preview (optional). */
  previewDocument?: { vorname: string; nachname: string } | null;
}

const DATE_FORMATS = [
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'DDMMYYYY', label: 'DDMMYYYY' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
];

function formatDate(format: string): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  switch (format) {
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DDMMYYYY':
      return `${dd}${mm}${yyyy}`;
    case 'DD-MM-YYYY':
      return `${dd}-${mm}-${yyyy}`;
    case 'DD.MM.YYYY':
    default:
      return `${dd}.${mm}.${yyyy}`;
  }
}

// --- Sub-components ---

function VariableChips({
  variables,
  onInsert,
}: {
  variables: VariableDefinition[];
  onInsert: (varName: string) => void;
}) {
  const sourceColors: Record<string, string> = {
    system: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
    xlsx: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
    custom: 'bg-violet-100 text-violet-800 hover:bg-violet-200',
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <button
          key={`${v.source}-${v.name}`}
          type="button"
          onClick={() => onInsert(v.name)}
          title={v.description}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${sourceColors[v.source] ?? 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          [{v.name}]
        </button>
      ))}
    </div>
  );
}

function DateFormatPicker({
  dateFormat,
  onDateFormatChange,
}: {
  dateFormat: string;
  onDateFormatChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="date-format" className="text-sm text-gray-600 whitespace-nowrap">
        Datumsformat:
      </label>
      <select
        id="date-format"
        value={dateFormat}
        onChange={(e) => onDateFormatChange(e.target.value)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {DATE_FORMATS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LivePreview({
  template,
  dateFormat,
  dokumentName,
  customVariables,
  previewDocument,
}: {
  template: string;
  dateFormat: string;
  dokumentName: string;
  customVariables: CustomVariable[];
  previewDocument?: { vorname: string; nachname: string } | null;
}) {
  const hasRealData = previewDocument && (previewDocument.vorname || previewDocument.nachname);

  const vars: TemplateVariables = {
    nachname: previewDocument?.nachname ?? '',
    vorname: previewDocument?.vorname ?? '',
    dokument: dokumentName,
    datum: formatDate(dateFormat),
    nummer: 1,
  };

  // Add custom variable values
  for (const cv of customVariables) {
    vars[cv.key.toLowerCase()] = cv.value;
  }

  // Build a rich preview showing which parts are filled and which are empty
  const parts = parseTemplate(template);
  const lowerKeyMap = new Map<string, string | number>();
  for (const [key, value] of Object.entries(vars)) {
    lowerKeyMap.set(key.toLowerCase(), value);
  }

  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-xs text-gray-500">
        {hasRealData ? 'Vorschau (Dokument 1): ' : 'Vorschau: '}
      </span>
      <span className="text-sm font-mono">
        {parts.map((part, i) => {
          if (part.type === 'literal') {
            return <span key={i} className="text-gray-800">{part.value}</span>;
          }
          const val = lowerKeyMap.get(part.value.toLowerCase());
          const strVal = val !== undefined ? String(val) : '';
          if (strVal) {
            return <span key={i} className="text-gray-800">{strVal}</span>;
          }
          return (
            <span key={i} className="text-gray-400 italic" title={`Variable [${part.value}] ist noch nicht belegt`}>
              [{part.value}]
            </span>
          );
        })}
        <span className="text-gray-800">.pdf</span>
      </span>
    </div>
  );
}

// --- Main component ---

export default function TemplateEditor({
  template,
  onTemplateChange,
  dateFormat,
  onDateFormatChange,
  dokumentName,
  onDokumentNameChange,
  customVariables,
  xlsxHeaders,
  previewDocument,
}: TemplateEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const availableVariables = getAvailableVariables(customVariables, xlsxHeaders);
  const availableVarNames = availableVariables.map((v) => v.name);
  const validation = validateTemplate(template, availableVarNames);

  const handleInsertVariable = (varName: string) => {
    const input = inputRef.current;
    if (!input) {
      onTemplateChange(template + `[${varName}]`);
      return;
    }

    const start = input.selectionStart ?? template.length;
    const end = input.selectionEnd ?? template.length;
    const insertion = `[${varName}]`;
    const newTemplate = template.slice(0, start) + insertion + template.slice(end);
    onTemplateChange(newTemplate);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      const newPos = start + insertion.length;
      input.setSelectionRange(newPos, newPos);
      input.focus();
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Dateinamen-Template</h3>
        <DateFormatPicker dateFormat={dateFormat} onDateFormatChange={onDateFormatChange} />
      </div>

      {/* Dokument name input */}
      <div>
        <label htmlFor="dokument-name" className="block text-xs text-gray-500 mb-1">
          Dokumentbezeichnung <span className="text-gray-400">(für Variable [Dokument])</span>
        </label>
        <input
          id="dokument-name"
          type="text"
          value={dokumentName}
          onChange={(e) => onDokumentNameChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="z.B. Endabrechnung Bonus, Zielvereinbarung 2026"
        />
      </div>

      {/* Template input */}
      <input
        ref={inputRef}
        type="text"
        value={template}
        onChange={(e) => onTemplateChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="z.B. [Nachname], [Vorname]_[Dokument] - [Datum]"
      />

      {/* Validation messages */}
      {validation.warnings.map((w, i) => (
        <p key={`warn-${i}`} className="text-xs text-amber-600 flex items-center gap-1">
          <span>⚠</span> {w}
        </p>
      ))}
      {validation.errors.map((e, i) => (
        <p key={`err-${i}`} className="text-xs text-red-600 flex items-center gap-1">
          <span>✕</span> {e}
        </p>
      ))}

      {/* Variable chips */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Verfügbare Variablen (klicken zum Einfügen):</p>
        <VariableChips variables={availableVariables} onInsert={handleInsertVariable} />
      </div>

      {/* Live preview */}
      <LivePreview template={template} dateFormat={dateFormat} dokumentName={dokumentName} customVariables={customVariables} previewDocument={previewDocument} />
    </div>
  );
}
