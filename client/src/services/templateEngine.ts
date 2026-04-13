import type {
  TemplatePart,
  TemplateVariables,
  VariableDefinition,
  CustomVariable,
  ValidationResult,
} from '../types';

export const DEFAULT_TEMPLATE = '[Nachname], [Vorname]_[Dokument] - [Datum]';

const SYSTEM_VARIABLES: VariableDefinition[] = [
  { name: 'Nachname', key: 'nachname', source: 'system', description: 'Nachname des Empfängers' },
  { name: 'Vorname', key: 'vorname', source: 'system', description: 'Vorname des Empfängers' },
  { name: 'Dokument', key: 'dokument', source: 'system', description: 'Dokumententyp bzw. Bezeichnung' },
  { name: 'Datum', key: 'datum', source: 'system', description: 'Datum im konfigurierten Format' },
  { name: 'Nummer', key: 'nummer', source: 'system', description: 'Laufende Nummer des Zieldokuments' },
];

/**
 * Parse a template string into an array of literal and variable parts.
 * Variables are denoted by square brackets: [VariableName]
 */
export function parseTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'literal', value: template.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'variable', value: match[1]! });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < template.length) {
    parts.push({ type: 'literal', value: template.slice(lastIndex) });
  }

  return parts;
}

/**
 * Generate a filename from a template and variable values.
 * Replaces all [Name] placeholders with corresponding values (case-insensitive key lookup)
 * and appends .pdf.
 */
export function generateFilename(template: string, variables: TemplateVariables): string {
  const parts = parseTemplate(template);
  const lowerKeyMap = new Map<string, string | number>();

  for (const [key, value] of Object.entries(variables)) {
    lowerKeyMap.set(key.toLowerCase(), value);
  }

  const result = parts
    .map((part) => {
      if (part.type === 'literal') return part.value;
      const val = lowerKeyMap.get(part.value.toLowerCase());
      return val !== undefined ? String(val) : `[${part.value}]`;
    })
    .join('');

  return result + '.pdf';
}

/**
 * Get all available variables by merging system variables, XLSX headers, and custom variables.
 */
export function getAvailableVariables(
  customVars: CustomVariable[],
  xlsxHeaders: string[],
): VariableDefinition[] {
  const variables: VariableDefinition[] = [...SYSTEM_VARIABLES];

  for (const header of xlsxHeaders) {
    variables.push({
      name: header,
      key: header.toLowerCase(),
      source: 'xlsx',
      description: `XLSX-Spalte: ${header}`,
    });
  }

  for (const cv of customVars) {
    variables.push({
      name: cv.label,
      key: cv.key.toLowerCase(),
      source: 'custom',
      description: `Benutzerdefiniert: ${cv.label}`,
    });
  }

  return variables;
}

/**
 * Validate a template against available variable names.
 * Returns warnings if no variables are found, errors if unknown variables are used.
 */
export function validateTemplate(
  template: string,
  availableVars: string[],
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const parts = parseTemplate(template);
  const variableParts = parts.filter((p) => p.type === 'variable');

  if (variableParts.length === 0) {
    warnings.push(
      'Das Template enthält keine Variablen. Alle Dateinamen wären identisch.',
    );
  }

  const availableLower = new Set(availableVars.map((v) => v.toLowerCase()));

  for (const vp of variableParts) {
    if (!availableLower.has(vp.value.toLowerCase())) {
      errors.push(`Unbekannte Variable: [${vp.value}]`);
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
