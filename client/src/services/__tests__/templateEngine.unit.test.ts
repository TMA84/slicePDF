import { describe, it, expect } from 'vitest';
import {
  parseTemplate,
  generateFilename,
  validateTemplate,
  getAvailableVariables,
  DEFAULT_TEMPLATE,
} from '../templateEngine';
import type { TemplateVariables } from '../../types';

/**
 * Unit tests for TemplateEngine
 * Validates: Requirements 5.1, 5.2, 5.7, 5.8, 5.9, 5.10
 */

describe('parseTemplate', () => {
  it('parses the default template into correct parts', () => {
    const parts = parseTemplate(DEFAULT_TEMPLATE);
    expect(parts).toEqual([
      { type: 'variable', value: 'Nachname' },
      { type: 'literal', value: ', ' },
      { type: 'variable', value: 'Vorname' },
      { type: 'literal', value: '_' },
      { type: 'variable', value: 'Dokument' },
      { type: 'literal', value: ' - ' },
      { type: 'variable', value: 'Datum' },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseTemplate('')).toEqual([]);
  });

  it('returns a single literal part for a template with no brackets', () => {
    const parts = parseTemplate('just plain text');
    expect(parts).toEqual([{ type: 'literal', value: 'just plain text' }]);
  });

  it('parses adjacent variables with no literal between them', () => {
    const parts = parseTemplate('[A][B]');
    expect(parts).toEqual([
      { type: 'variable', value: 'A' },
      { type: 'variable', value: 'B' },
    ]);
  });
});

describe('generateFilename', () => {
  const defaultVars: TemplateVariables = {
    nachname: 'Malcherek',
    vorname: 'Tobias',
    dokument: 'Endabrechnung Bonus',
    datum: '29.04.2025',
    nummer: 1,
  };

  it('generates the correct filename from the default template', () => {
    const result = generateFilename(DEFAULT_TEMPLATE, defaultVars);
    expect(result).toBe('Malcherek, Tobias_Endabrechnung Bonus - 29.04.2025.pdf');
  });

  it('preserves special characters like umlauts and spaces', () => {
    const vars: TemplateVariables = {
      nachname: 'Müller',
      vorname: 'Jürgen',
      dokument: 'Über Änderungen',
      datum: '01.01.2025',
      nummer: 1,
    };
    const result = generateFilename('[Nachname]_[Vorname]', vars);
    expect(result).toBe('Müller_Jürgen.pdf');
  });

  it('keeps placeholder when variable is missing from the map', () => {
    const vars: TemplateVariables = {
      nachname: 'Test',
      vorname: '',
      dokument: '',
      datum: '',
      nummer: 0,
    };
    const result = generateFilename('[Nachname]_[Unbekannt]', vars);
    expect(result).toBe('Test_[Unbekannt].pdf');
  });

  it('ignores extra variables not referenced in the template', () => {
    const vars: TemplateVariables = {
      nachname: 'Schmidt',
      vorname: 'Anna',
      dokument: 'Brief',
      datum: '01.01.2025',
      nummer: 1,
      extra: 'ignored',
    };
    const result = generateFilename('[Nachname]', vars);
    expect(result).toBe('Schmidt.pdf');
  });

  it('performs case-insensitive variable lookup', () => {
    const vars: TemplateVariables = {
      nachname: 'Weber',
      vorname: '',
      dokument: '',
      datum: '',
      nummer: 0,
    };
    const result = generateFilename('[nachname]_[NACHNAME]', vars);
    expect(result).toBe('Weber_Weber.pdf');
  });
});


describe('validateTemplate', () => {
  const knownVars = ['Nachname', 'Vorname', 'Dokument', 'Datum', 'Nummer'];

  it('returns valid with no warnings or errors for a valid template', () => {
    const result = validateTemplate('[Nachname], [Vorname]', knownVars);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('warns about identical filenames when template has no variables', () => {
    const result = validateTemplate('static-name', knownVars);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.toLowerCase().includes('identisch'))).toBe(true);
  });

  it('returns invalid with error for an unknown variable', () => {
    const result = validateTemplate('[Unbekannt]', knownVars);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('Unbekannt'))).toBe(true);
  });

  it('returns error only for unknown variables when mixed with known ones', () => {
    const result = validateTemplate('[Nachname]_[Foo]_[Vorname]', knownVars);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Foo');
  });
});

describe('getAvailableVariables', () => {
  it('returns only system variables when no custom vars or xlsx headers', () => {
    const vars = getAvailableVariables([], []);
    const systemNames = vars.filter((v) => v.source === 'system').map((v) => v.name);
    expect(systemNames).toContain('Nachname');
    expect(systemNames).toContain('Vorname');
    expect(systemNames).toContain('Dokument');
    expect(systemNames).toContain('Datum');
    expect(systemNames).toContain('Nummer');
    expect(vars.every((v) => v.source === 'system')).toBe(true);
  });

  it('includes xlsx headers as xlsx-sourced variables', () => {
    const vars = getAvailableVariables([], ['Abteilung', 'Standort']);
    const xlsxVars = vars.filter((v) => v.source === 'xlsx');
    expect(xlsxVars).toHaveLength(2);
    expect(xlsxVars.map((v) => v.name)).toEqual(['Abteilung', 'Standort']);
  });

  it('includes custom variables as custom-sourced variables', () => {
    const vars = getAvailableVariables(
      [{ key: 'projekt', label: 'Projekt', value: 'Alpha' }],
      [],
    );
    const customVars = vars.filter((v) => v.source === 'custom');
    expect(customVars).toHaveLength(1);
    expect(customVars[0].name).toBe('Projekt');
    expect(customVars[0].key).toBe('projekt');
  });
});
