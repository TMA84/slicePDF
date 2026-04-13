import { describe, it, expect } from 'vitest';
import { extractName } from '../nameExtractionService.js';

describe('extractName', () => {
  // --- Pattern 1: Sehr geehrter Herr/Frau Vorname Nachname ---

  it('extracts name from "Sehr geehrter Herr Vorname Nachname"', () => {
    const text = 'Sehr geehrter Herr Tobias Malcherek\nIhre Endabrechnung';
    const result = extractName(text);
    expect(result).toEqual({
      vorname: 'Tobias',
      nachname: 'Malcherek',
      raw: 'Sehr geehrter Herr Tobias Malcherek',
    });
  });

  // --- Pattern 2: Herr/Frau Vorname Nachname ---

  it('extracts name from "Frau Vorname Nachname"', () => {
    const text = 'Frau Anna Müller\nBetreff: Zielvereinbarung';
    const result = extractName(text);
    expect(result).toEqual({
      vorname: 'Anna',
      nachname: 'Müller',
      raw: 'Frau Anna Müller',
    });
  });

  // --- Pattern 4: Nachname, Vorname ---

  it('extracts name from "Nachname, Vorname"', () => {
    const text = 'Malcherek, Tobias\nEndabrechnung Bonus';
    const result = extractName(text);
    expect(result).toEqual({
      vorname: 'Tobias',
      nachname: 'Malcherek',
      raw: 'Malcherek, Tobias',
    });
  });

  // --- Pattern 5: Vorname Nachname on its own line ---

  it('extracts name from "Vorname Nachname" on its own line', () => {
    const text = 'Tobias Malcherek\nAbteilung Finanzen';
    const result = extractName(text);
    expect(result).toEqual({
      vorname: 'Tobias',
      nachname: 'Malcherek',
      raw: 'Tobias Malcherek',
    });
  });

  // --- Priority order ---

  it('prefers salutation pattern over line-based pattern', () => {
    const text = 'Herr Max Mustermann\nMustermann, Max';
    const result = extractName(text);
    expect(result).toEqual({
      vorname: 'Max',
      nachname: 'Mustermann',
      raw: 'Herr Max Mustermann',
    });
  });

  // --- Umlauts and special characters ---

  it('handles German umlauts in names', () => {
    const text = 'Herr Jörg Böhm\nBetreff';
    const result = extractName(text);
    expect(result).toEqual({
      vorname: 'Jörg',
      nachname: 'Böhm',
      raw: 'Herr Jörg Böhm',
    });
  });

  it('handles hyphenated names', () => {
    const text = 'Frau Anna-Lena Schmidt-Müller\nBetreff';
    const result = extractName(text);
    expect(result).toEqual({
      vorname: 'Anna-Lena',
      nachname: 'Schmidt-Müller',
      raw: 'Frau Anna-Lena Schmidt-Müller',
    });
  });

  // --- Geschäftsführer context filtering ---

  it('skips names in Geschäftsführer context', () => {
    const text = [
      'Geschäftsführer:',
      'Dr. Markus Eisel',
      'Stefan Billeb',
      '',
      'Lieber Tobias,',
      'wir freuen uns...',
    ].join('\n');
    const result = extractName(text);
    expect(result).not.toBeNull();
    expect(result!.vorname).toBe('Tobias');
  });

  // --- Lieber/Liebe pattern ---

  it('extracts first name from "Lieber Vorname," when no full name found', () => {
    const text = 'Lieber Tobias,\nwir freuen uns sehr.';
    const result = extractName(text);
    expect(result).not.toBeNull();
    expect(result!.vorname).toBe('Tobias');
  });

  // --- Contract pattern ---

  it('extracts name from contract-style "und\\nVorname Nachname"', () => {
    const text = [
      'Zielvereinbarung 2026',
      'zwischen',
      'Firma GmbH',
      'Kölner Straße 3',
      '65760 Eschborn',
      '– im Folgenden Firma genannt –',
      'und',
      'Tobias Malcherek',
      'Gutenbergstraße 15',
      '65468 Trebur',
    ].join('\n');
    const result = extractName(text);
    expect(result).toEqual({
      vorname: 'Tobias',
      nachname: 'Malcherek',
      raw: 'Tobias Malcherek',
    });
  });

  // --- No match / edge cases ---

  it('returns null for empty text', () => {
    expect(extractName('')).toBeNull();
  });

  it('returns null for text with no name patterns', () => {
    const text = 'Dies ist ein Dokument ohne erkennbare Namen 12345';
    expect(extractName(text)).toBeNull();
  });
});
