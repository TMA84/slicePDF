import ExcelJS from 'exceljs';
import type { XlsxInfo, NameMapping } from '../types';

/**
 * Parse an XLSX file and extract headers, row count, sheet name, and raw data.
 */
export async function loadXlsx(file: File): Promise<XlsxInfo> {
  const buffer = await file.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error('Die hochgeladene Datei ist kein gültiges XLSX-Format.');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('Die XLSX-Datei enthält keine Arbeitsblätter.');
  }

  const sheetName = sheet.name;

  // Extract all rows as 2D array
  const rawRows: unknown[][] = [];
  sheet.eachRow((row, _rowNumber) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Pad with empty strings for skipped columns
      while (values.length < colNumber - 1) {
        values.push('');
      }
      values.push(cell.text ?? String(cell.value ?? ''));
    });
    rawRows.push(values);
  });

  if (rawRows.length === 0) {
    throw new Error('Die XLSX-Datei ist leer.');
  }

  const headerRow = rawRows[0]!;
  const headers = headerRow.map((h) => String(h ?? ''));
  const rawData = rawRows.slice(1);
  const rowCount = rawData.length;

  return { headers, rowCount, sheetName, rawData };
}

/**
 * Map XLSX rows to NameMapping[] using the specified Vorname/Nachname columns.
 * All other columns become additionalFields.
 */
export function readColumns(
  xlsxData: XlsxInfo,
  vornameColumn: string,
  nachnameColumn: string,
): NameMapping[] {
  const { headers, rawData } = xlsxData;

  const vornameIdx = headers.indexOf(vornameColumn);
  const nachnameIdx = headers.indexOf(nachnameColumn);

  if (vornameIdx === -1) {
    throw new Error(
      `Spalte "${vornameColumn}" wurde in der XLSX-Datei nicht gefunden.`,
    );
  }
  if (nachnameIdx === -1) {
    throw new Error(
      `Spalte "${nachnameColumn}" wurde in der XLSX-Datei nicht gefunden.`,
    );
  }

  return rawData.map((row) => {
    const cells = row as unknown[];
    const vorname = String(cells[vornameIdx] ?? '');
    const nachname = String(cells[nachnameIdx] ?? '');

    const additionalFields: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      if (i !== vornameIdx && i !== nachnameIdx) {
        const header = headers[i];
        if (header) {
          additionalFields[header] = String(cells[i] ?? '');
        }
      }
    }

    return { vorname, nachname, additionalFields };
  });
}
