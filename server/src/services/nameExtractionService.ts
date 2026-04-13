import type { ExtractedName } from '../types.js';

/** Words that are clearly not personal names. */
const NON_NAME_WORDS = new Set([
  'gmbh', 'ag', 'kg', 'ohg', 'mbh', 'ug', 'se', 'ev',
  'str', 'straße', 'strasse', 'weg', 'platz', 'allee',
  'bank', 'sparkasse', 'volksbank',
  'amtsgericht', 'handelsregister', 'umsatzsteuer',
  'geschäftsführer', 'geschäftsführerin', 'vorstand',
  'iban', 'bic', 'swift',
  'tel', 'fax', 'email', 'mail', 'www', 'http', 'https',
  'hamburg', 'berlin', 'münchen', 'frankfurt', 'köln', 'düsseldorf',
  'eschborn', 'stuttgart', 'hannover', 'bremen', 'dresden', 'leipzig',
  'kölner', 'berliner', 'münchner', 'frankfurter',
  'innovations', 'technology', 'software', 'consulting', 'solutions', 'services',
  'commercial', 'international', 'digital', 'management',
  'valantic', 'docusign', 'envelope',
  'folgenden', 'arbeitnehmer', 'arbeitnehmerin', 'arbeitgeber', 'parteien',
  'lieber', 'liebe', 'lieben', 'sehr', 'geehrter', 'geehrte',
  'zielvereinbarung', 'endabrechnung', 'auszahlung', 'bonus',
  'bankverbindung', 'herr', 'frau',
]);

function isNonName(word: string): boolean {
  return NON_NAME_WORDS.has(word.toLowerCase());
}

function isNonNameLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (/\d/.test(line)) return true;
  if (lower.includes('@') || lower.includes('www.') || lower.includes('http')) return true;
  if (lower.includes('gmbh') || lower.includes(' ag ') || lower.includes('str.') || lower.includes('straße')) return true;
  if (lower.includes('iban') || lower.includes('bic:') || lower.includes('hrb ')) return true;
  if (lower.includes('geschäftsführer') || lower.includes('vorstand')) return true;
  if (lower.includes('umsatzsteuer') || lower.includes('amtsgericht')) return true;
  if (lower.includes('– im folgenden') || lower.includes('- im folgenden')) return true;
  if (lower.includes('genannt')) return true;
  return false;
}

function isInOfficerContext(fullText: string, linePos: number): boolean {
  const before = fullText.slice(Math.max(0, linePos - 300), linePos).toLowerCase();
  return before.includes('geschäftsführer') || before.includes('vorstand');
}

/**
 * Check if a line looks like a street address.
 * Matches: "Straße 123", "Weg 5a", but also generic "word(s) number" patterns
 * that are typical for German addresses (e.g., "Musterweg 12", "Am Ring 5").
 */
function isAddressLine(line: string): boolean {
  // Known street suffixes
  if (/(?:str\.|straße|strasse|weg|platz|allee|gasse|ring|damm|ufer|chaussee)\s*\d/i.test(line)) return true;
  // Generic pattern: one or more words followed by a house number at the end
  // e.g., "gfdhlk 67", "Mustermannstraße 1 13", "Am Markt 5a"
  if (/^[^\d]+\s+\d+[a-zA-Z]?\s*$/.test(line)) return true;
  return false;
}

/**
 * Extract a name (Vorname + Nachname) from the text content of a PDF page.
 *
 * Searches the ENTIRE text (not just the first N chars) using multiple
 * strategies tailored to German serial letters and contracts.
 */
export function extractName(text: string): ExtractedName | null {
  if (!text || !text.trim()) return null;

  const lines = text.split(/\n/).map(l => l.trim());

  // === Strategy 1: Contract pattern "und\nVorname Nachname\nAdresse\n...Folgenden" ===
  // Most specific — only matches when "und" + address + "Folgenden" context is present
  const contractName = findContractName(lines, text);
  if (contractName) return contractName;

  // === Strategy 2: Address block at the very end of the page ===
  // Only scan the last 8 non-empty lines to avoid matching mid-page address blocks
  const tailLines = lines.filter(Boolean).slice(-8);
  const addressBlockName = findNameBeforeAddress(tailLines);
  if (addressBlockName) return addressBlockName;

  // === Strategy 3: "Sehr geehrter Herr/Frau Vorname Nachname" ===
  const formalMatch = text.match(/Sehr\s+geehrte[r]?\s+(?:Herr|Frau)\s+(\S+)\s+(\S+)/);
  if (formalMatch) {
    return { vorname: formalMatch[1], nachname: formalMatch[2], raw: formalMatch[0] };
  }

  // === Strategy 4: "Herr/Frau Vorname Nachname" (not in Geschäftsführer context) ===
  const salutationRe = /\b(?:Herr|Frau)\s+(\S+)\s+(\S+)/g;
  let salMatch;
  while ((salMatch = salutationRe.exec(text)) !== null) {
    if (!isInOfficerContext(text, salMatch.index) && !isNonName(salMatch[1]) && !isNonName(salMatch[2])) {
      return { vorname: salMatch[1], nachname: salMatch[2], raw: salMatch[0] };
    }
  }

  // === Strategy 5: "Nachname, Vorname" (comma-separated on its own line) ===
  const commaMatch = text.match(/^([^\s,]+),\s+([^\s,]+)$/m);
  if (commaMatch && !isNonName(commaMatch[1]) && !isNonName(commaMatch[2])) {
    return { vorname: commaMatch[2], nachname: commaMatch[1], raw: commaMatch[0] };
  }

  // === Strategy 5: "Lieber Vorname," — extract first name, look for full name elsewhere ===
  const lieberMatch = text.match(/Liebe[r]?\s+(\S+)\s*[,!]/);
  const lieberVorname = lieberMatch ? lieberMatch[1] : null;

  // === Strategy 6: "Vorname Nachname" on its own line (not in officer context) ===
  const lineBasedName = findNameOnOwnLine(lines, text, lieberVorname);
  if (lineBasedName) return lineBasedName;

  // === Strategy 7: Only first name from "Lieber" ===
  if (lieberVorname && !isNonName(lieberVorname)) {
    return { vorname: lieberVorname, nachname: '', raw: lieberMatch![0] };
  }

  return null;
}

/**
 * Find a name line that appears directly before an address line (street + PLZ).
 * Scans from the END of the document backwards — the address block in
 * Serienbriefe is typically at the very bottom.
 * NOTE: Does NOT use isNonNameLine here because the address block context
 * is strong enough to identify the name reliably.
 */
function findNameBeforeAddress(lines: string[]): ExtractedName | null {
  for (let i = lines.length - 1; i >= 1; i--) {
    const line = lines[i];
    // Look for a PLZ+Ort line (5-digit number followed by city name)
    if (!/^\d{5}\s+\S/.test(line)) continue;

    // The line before PLZ should be a street address
    const streetLine = lines[i - 1];
    if (!streetLine) continue;

    if (isAddressLine(streetLine)) {
      // Name is 2 lines before PLZ: Name\nStraße\nPLZ Ort
      if (i < 2) continue;
      const nameLine = lines[i - 2];
      if (!nameLine || nameLine.length > 60) continue;
      // Don't filter by isNonNameLine — the address context is reliable enough
      const parts = nameLine.split(/\s+/).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 4) {
        return {
          vorname: parts.slice(0, -1).join(' '),
          nachname: parts[parts.length - 1],
          raw: nameLine,
        };
      }
    } else {
      // Maybe street+number is combined with something, or street line is missing
      // Check if the line before PLZ is the name directly (no street line)
      const maybeName = streetLine;
      if (maybeName.length < 60 && !isAddressLine(maybeName)) {
        const parts = maybeName.split(/\s+/).filter(Boolean);
        if (parts.length >= 2 && parts.length <= 4) {
          return {
            vorname: parts.slice(0, -1).join(' '),
            nachname: parts[parts.length - 1],
            raw: maybeName,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Find a name in a contract pattern: "und\nVorname Nachname\nAdresse\n...Folgenden"
 */
function findContractName(lines: string[], _fullText: string): ExtractedName | null {
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].toLowerCase() !== 'und') continue;

    // The next non-empty line after "und" should be the name
    let nameIdx = i + 1;
    while (nameIdx < lines.length && !lines[nameIdx]) nameIdx++;
    if (nameIdx >= lines.length) continue;

    const nameLine = lines[nameIdx];
    if (!nameLine || nameLine.length > 60) continue;

    // Verify: a few lines later there should be "im Folgenden" or an address
    let hasContext = false;
    for (let j = nameIdx + 1; j < Math.min(nameIdx + 5, lines.length); j++) {
      const lower = lines[j].toLowerCase();
      if (lower.includes('folgenden') || lower.includes('genannt') || /^\d{5}/.test(lines[j])) {
        hasContext = true;
        break;
      }
    }
    if (!hasContext) continue;

    const parts = nameLine.split(/\s+/);
    if (parts.length >= 2 && parts.length <= 4) {
      return {
        vorname: parts.slice(0, -1).join(' '),
        nachname: parts[parts.length - 1],
        raw: nameLine,
      };
    }
  }
  return null;
}

/**
 * Find "Vorname Nachname" on its own line, avoiding officer context.
 */
function findNameOnOwnLine(lines: string[], fullText: string, preferVorname: string | null): ExtractedName | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length > 60 || line.length < 3) continue;
    if (isNonNameLine(line)) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 2 || parts.length > 4) continue;

    const allValid = parts.every(p => !isNonName(p));
    const allCapitalized = parts.every(p => /^[\p{Lu}]/u.test(p));
    if (!allValid || !allCapitalized) continue;

    // Calculate position in full text for context check
    const linePos = fullText.indexOf(line);
    if (isInOfficerContext(fullText, linePos)) continue;

    // Prefer lines containing the first name from "Lieber" pattern
    if (preferVorname && parts[0] === preferVorname) {
      return {
        vorname: parts.slice(0, -1).join(' '),
        nachname: parts[parts.length - 1],
        raw: line,
      };
    }

    // Otherwise take the first valid match
    if (!preferVorname) {
      return {
        vorname: parts.slice(0, -1).join(' '),
        nachname: parts[parts.length - 1],
        raw: line,
      };
    }
  }

  // Second pass without preferVorname constraint
  if (preferVorname) {
    return findNameOnOwnLine(lines, fullText, null);
  }

  return null;
}
