import { describe } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { generateFilename } from '../templateEngine';
import type { TemplateVariables } from '../../types';

/**
 * Feature: pdf-serial-letter-splitter, Property 3: Template-Variablen-Ersetzung
 *
 * Validates: Requirements 5.2, 5.10
 *
 * For all valid templates and arbitrary variable values, generateFilename(template, variables)
 * shall replace every [Name] placeholder with the corresponding value, preserve all literal
 * parts unchanged, and the resulting filename shall always end with `.pdf`.
 */
describe('Feature: pdf-serial-letter-splitter, Property 3: Template-Variablen-Ersetzung', () => {
  // Generator for valid variable names (alphanumeric, non-empty)
  const varNameArb = fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/);

  // Generator for literal text that does NOT contain '[' or ']'
  const literalArb = fc.string().map((s) => s.replace(/[\[\]]/g, ''));

  // Generator for variable values (strings without brackets)
  const varValueArb = fc
    .string({ minLength: 1 })
    .map((s) => s.replace(/[\[\]]/g, '') || 'x');

  // Build a template with interleaved literals and [VarName] placeholders,
  // along with the corresponding variable map.
  const templateWithVarsArb = fc
    .array(fc.tuple(literalArb, varNameArb, varValueArb), {
      minLength: 1,
      maxLength: 5,
    })
    .chain((parts) =>
      literalArb.map((trailingLiteral) => {
        let template = '';
        const variables: Record<string, string> = {};

        for (const [literal, varName, varValue] of parts) {
          template += literal + `[${varName}]`;
          variables[varName.toLowerCase()] = varValue;
        }
        template += trailingLiteral;

        // Collect non-empty literal segments for verification
        const literals: string[] = [];
        for (const [literal] of parts) {
          if (literal.length > 0) literals.push(literal);
        }
        if (trailingLiteral.length > 0) literals.push(trailingLiteral);

        return { template, variables, literals, parts };
      }),
    );

  test.prop([templateWithVarsArb], { numRuns: 100 })(
    'all placeholders are replaced, literals preserved, result ends with .pdf',
    ({ template, variables, literals, parts }) => {
      const vars: TemplateVariables = {
        nachname: '',
        vorname: '',
        dokument: '',
        datum: '',
        nummer: 0,
        ...variables,
      };

      const result = generateFilename(template, vars);

      // 1. Result must end with .pdf
      if (!result.endsWith('.pdf')) {
        throw new Error(`Result does not end with .pdf: "${result}"`);
      }

      // 2. No [VarName] placeholders should remain for variables we provided
      for (const [, varName] of parts) {
        const placeholder = `[${varName}]`;
        if (result.includes(placeholder)) {
          throw new Error(
            `Placeholder ${placeholder} was not replaced in result: "${result}"`,
          );
        }
      }

      // 3. All literal parts from the template must be preserved in the result
      const resultWithoutPdf = result.slice(0, -4);
      for (const literal of literals) {
        if (!resultWithoutPdf.includes(literal)) {
          throw new Error(
            `Literal "${literal}" not found in result: "${resultWithoutPdf}"`,
          );
        }
      }
    },
  );
});

import { validateTemplate } from '../templateEngine';

/**
 * Feature: pdf-serial-letter-splitter, Property 5: Template-Validierung
 *
 * Validates: Requirements 5.8
 *
 * For all strings that contain no [...]  substring, validateTemplate shall return
 * a warning indicating that all filenames would be identical.
 */
describe('Feature: pdf-serial-letter-splitter, Property 5: Template-Validierung', () => {
  // Generator for strings that do NOT contain any [Content] pattern.
  // We strip all square brackets to guarantee no [...]  can form.
  const noVarTemplateArb = fc.string().map((s) => s.replace(/[\[\]]/g, ''));

  // Arbitrary list of available variable names (content doesn't matter for this property)
  const availableVarsArb = fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
    minLength: 0,
    maxLength: 5,
  });

  test.prop([noVarTemplateArb, availableVarsArb], { numRuns: 100 })(
    'templates without [Var] placeholders produce a warning about identical filenames',
    (template, availableVars) => {
      const result = validateTemplate(template, availableVars);

      // 1. valid should be true (no errors, only warnings)
      if (result.valid !== true) {
        throw new Error(
          `Expected valid to be true for template without variables, got false. Errors: ${result.errors.join(', ')}`,
        );
      }

      // 2. There should be at least one warning
      if (result.warnings.length === 0) {
        throw new Error(
          `Expected at least one warning for template "${template}" without variables, but got none.`,
        );
      }

      // 3. At least one warning should mention identical filenames
      const hasIdenticalWarning = result.warnings.some((w) =>
        w.toLowerCase().includes('identisch'),
      );
      if (!hasIdenticalWarning) {
        throw new Error(
          `Expected a warning containing "identisch" but got: ${result.warnings.join('; ')}`,
        );
      }
    },
  );
});
