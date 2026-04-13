import { describe } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { readColumns } from '../xlsxService';
import type { XlsxInfo } from '../../types';

/**
 * Feature: pdf-serial-letter-splitter, Property 2: XLSX-Namenszuordnung
 *
 * Validates: Requirements 4.4
 *
 * For all valid XLSX datasets with n rows and a list of n target documents,
 * the mapping shall assign row i (0-based) to target document i, correctly
 * adopting Vorname and Nachname from the selected columns.
 */
describe('Feature: pdf-serial-letter-splitter, Property 2: XLSX-Namenszuordnung', () => {
  // Generator for non-empty name strings (no empty strings allowed)
  const nameArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

  // Generator for an array of { vorname, nachname } entries
  const entriesArb = fc.array(
    fc.record({ vorname: nameArb, nachname: nameArb }),
    { minLength: 1, maxLength: 50 },
  );

  test.prop([entriesArb], { numRuns: 100 })(
    'readColumns maps row i to document i, preserving order and values',
    (entries) => {
      // Build an XlsxInfo object with headers ['Vorname', 'Nachname'] and rawData from entries
      const xlsxData: XlsxInfo = {
        headers: ['Vorname', 'Nachname'],
        rowCount: entries.length,
        sheetName: 'Sheet1',
        rawData: entries.map((e) => [e.vorname, e.nachname]),
      };

      const result = readColumns(xlsxData, 'Vorname', 'Nachname');

      // 1. Result has same length as input entries
      if (result.length !== entries.length) {
        throw new Error(
          `Expected ${entries.length} mappings, got ${result.length}`,
        );
      }

      // 2. For each index i, result[i] matches entries[i] — order is preserved
      for (let i = 0; i < entries.length; i++) {
        if (result[i].vorname !== entries[i].vorname) {
          throw new Error(
            `Row ${i}: expected vorname "${entries[i].vorname}", got "${result[i].vorname}"`,
          );
        }
        if (result[i].nachname !== entries[i].nachname) {
          throw new Error(
            `Row ${i}: expected nachname "${entries[i].nachname}", got "${result[i].nachname}"`,
          );
        }
      }
    },
  );
});

import { getAvailableVariables } from '../templateEngine';

/**
 * Feature: pdf-serial-letter-splitter, Property 4: XLSX-Headers als Variablen
 *
 * Validates: Requirements 4.2, 5.5
 *
 * For all valid lists of XLSX column headers, each header shall appear as an
 * available variable with source 'xlsx' in the template system, and the count
 * of xlsx-sourced variables shall equal the number of input headers.
 */
describe('Feature: pdf-serial-letter-splitter, Property 4: XLSX-Headers als Variablen', () => {
  // Generator for unique non-empty header strings
  const uniqueHeadersArb = fc
    .array(
      fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
      { minLength: 0, maxLength: 50 },
    )
    .map((arr) => [...new Set(arr)]);

  test.prop([uniqueHeadersArb], { numRuns: 100 })(
    'each XLSX header appears as a variable with source xlsx, count matches',
    (headers) => {
      const variables = getAvailableVariables([], headers);

      const xlsxVars = variables.filter((v) => v.source === 'xlsx');

      // 1. Count of xlsx-sourced variables equals number of input headers
      if (xlsxVars.length !== headers.length) {
        throw new Error(
          `Expected ${headers.length} xlsx variables, got ${xlsxVars.length}`,
        );
      }

      // 2. Each header appears as a variable with source 'xlsx'
      for (const header of headers) {
        const found = xlsxVars.find((v) => v.name === header);
        if (!found) {
          throw new Error(
            `Header "${header}" not found among xlsx variables`,
          );
        }
        if (found.source !== 'xlsx') {
          throw new Error(
            `Variable for header "${header}" has source "${found.source}", expected "xlsx"`,
          );
        }
      }
    },
  );
});
