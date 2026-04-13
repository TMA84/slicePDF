import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { loadXlsx, readColumns } from '../xlsxService';
import type { XlsxInfo } from '../../types';

/**
 * Unit tests for XlsxService
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6
 */

// Helper: create a File from an ExcelJS workbook
async function createXlsxFile(data: unknown[][], sheetName = 'Sheet1'): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  for (const row of data) {
    ws.addRow(row);
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new File([buffer], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('loadXlsx', () => {
  it('returns correct headers, rowCount, sheetName, and rawData for a valid XLSX file', async () => {
    const data = [
      ['Vorname', 'Nachname', 'Abteilung'],
      ['Tobias', 'Malcherek', 'IT'],
      ['Anna', 'Schmidt', 'HR'],
    ];
    const file = await createXlsxFile(data, 'Mitarbeiter');

    const result = await loadXlsx(file);

    expect(result.headers).toEqual(['Vorname', 'Nachname', 'Abteilung']);
    expect(result.rowCount).toBe(2);
    expect(result.sheetName).toBe('Mitarbeiter');
    expect(result.rawData).toEqual([
      ['Tobias', 'Malcherek', 'IT'],
      ['Anna', 'Schmidt', 'HR'],
    ]);
  });

  it('throws an error for an invalid file', async () => {
    const corruptedData = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff]);
    const file = new File([corruptedData], 'bad.xlsx');

    await expect(loadXlsx(file)).rejects.toThrow(
      'Die hochgeladene Datei ist kein gültiges XLSX-Format.',
    );
  });
});

describe('readColumns', () => {
  it('returns correct NameMapping array with vorname, nachname for matching columns', () => {
    const xlsxData: XlsxInfo = {
      headers: ['Vorname', 'Nachname'],
      rowCount: 2,
      sheetName: 'Sheet1',
      rawData: [
        ['Tobias', 'Malcherek'],
        ['Anna', 'Schmidt'],
      ],
    };

    const result = readColumns(xlsxData, 'Vorname', 'Nachname');

    expect(result).toEqual([
      { vorname: 'Tobias', nachname: 'Malcherek', additionalFields: {} },
      { vorname: 'Anna', nachname: 'Schmidt', additionalFields: {} },
    ]);
  });

  it('throws an error mentioning the column name when vorname column is missing', () => {
    const xlsxData: XlsxInfo = {
      headers: ['Name', 'Nachname'],
      rowCount: 1,
      sheetName: 'Sheet1',
      rawData: [['Tobias', 'Malcherek']],
    };

    expect(() => readColumns(xlsxData, 'Vorname', 'Nachname')).toThrow(
      'Spalte "Vorname" wurde in der XLSX-Datei nicht gefunden.',
    );
  });

  it('throws an error mentioning the column name when nachname column is missing', () => {
    const xlsxData: XlsxInfo = {
      headers: ['Vorname', 'Familienname'],
      rowCount: 1,
      sheetName: 'Sheet1',
      rawData: [['Tobias', 'Malcherek']],
    };

    expect(() => readColumns(xlsxData, 'Vorname', 'Nachname')).toThrow(
      'Spalte "Nachname" wurde in der XLSX-Datei nicht gefunden.',
    );
  });

  it('returns an empty array when there are no data rows', () => {
    const xlsxData: XlsxInfo = {
      headers: ['Vorname', 'Nachname'],
      rowCount: 0,
      sheetName: 'Sheet1',
      rawData: [],
    };

    expect(readColumns(xlsxData, 'Vorname', 'Nachname')).toEqual([]);
  });

  it('populates additionalFields correctly for rows with extra columns', () => {
    const xlsxData: XlsxInfo = {
      headers: ['Vorname', 'Nachname', 'Abteilung', 'Standort'],
      rowCount: 2,
      sheetName: 'Sheet1',
      rawData: [
        ['Tobias', 'Malcherek', 'IT', 'Berlin'],
        ['Anna', 'Schmidt', 'HR', 'München'],
      ],
    };

    const result = readColumns(xlsxData, 'Vorname', 'Nachname');

    expect(result).toEqual([
      {
        vorname: 'Tobias',
        nachname: 'Malcherek',
        additionalFields: { Abteilung: 'IT', Standort: 'Berlin' },
      },
      {
        vorname: 'Anna',
        nachname: 'Schmidt',
        additionalFields: { Abteilung: 'HR', Standort: 'München' },
      },
    ]);
  });
});
