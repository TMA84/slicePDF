import type { CustomVariable } from '../types';

export interface CustomVariableManagerProps {
  variables: CustomVariable[];
  onChange: (vars: CustomVariable[]) => void;
}

function generateKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9äöüß]/g, '');
}

export default function CustomVariableManager({
  variables,
  onChange,
}: CustomVariableManagerProps) {
  const handleAdd = () => {
    onChange([...variables, { key: '', label: '', value: '' }]);
  };

  const handleLabelChange = (index: number, label: string) => {
    const updated = variables.map((v, i) =>
      i === index ? { ...v, label, key: generateKey(label) } : v
    );
    onChange(updated);
  };

  const handleValueChange = (index: number, value: string) => {
    const updated = variables.map((v, i) =>
      i === index ? { ...v, value } : v
    );
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
      <h3 className="text-sm font-medium text-gray-700">
        Benutzerdefinierte Variablen
      </h3>

      {variables.length === 0 && (
        <p className="text-xs text-gray-400">
          Keine benutzerdefinierten Variablen vorhanden.
        </p>
      )}

      {variables.map((variable, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={variable.label}
            onChange={(e) => handleLabelChange(index, e.target.value)}
            placeholder="Name (z.B. Dokument)"
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            value={variable.value}
            onChange={(e) => handleValueChange(index, e.target.value)}
            placeholder="Wert"
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => handleRemove(index)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Variable entfernen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1 rounded border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
        Variable hinzufügen
      </button>
    </div>
  );
}
