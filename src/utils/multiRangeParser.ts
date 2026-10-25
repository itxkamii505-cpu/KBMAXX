import { COUNTRY_CALLING_CODES } from './countryLookup';

export interface ParsedRangeBatchItem {
  name: string;
  prefix: string;
  countryNote: string;
  numbers: string[];
  sampleNumbers: string[];
  totalCount: number;
}

export interface MultiRangeParseResult {
  items: ParsedRangeBatchItem[];
  totalRanges: number;
  totalNumbers: number;
  rawLineCount: number;
  detectedHeaders: {
    rangeCol: number;
    prefixCol: number;
    numberCol: number;
  } | null;
}

/**
 * Detects international country & calling code prefix from a phone number or prefix string
 */
export function detectCountryAndPrefix(phoneOrPrefix: string): { prefix: string; country: string } {
  if (!phoneOrPrefix) return { prefix: '1', country: 'Worldwide' };
  let clean = phoneOrPrefix.replace(/\D/g, '');
  if (clean.startsWith('00')) clean = clean.slice(2);
  if (!clean) return { prefix: '1', country: 'Worldwide' };

  for (const len of [4, 3, 2, 1]) {
    const candidate = clean.slice(0, len);
    if (COUNTRY_CALLING_CODES[candidate]) {
      return { prefix: candidate, country: COUNTRY_CALLING_CODES[candidate] };
    }
  }

  return { prefix: clean.slice(0, 3) || '1', country: 'Worldwide' };
}

/**
 * Robust CSV Line Parser supporting quoted strings, commas, tabs, and semicolons
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  // Clean surrounding quotes
  return result.map((col) => col.replace(/^"+|"+$/g, '').trim());
}

/**
 * Intelligent Document & CSV Parser for Multi-Range Bulk Imports
 * Supports:
 * - "","Range","Prefix","Number"
 * - Range,Prefix,Number
 * - Range,Number
 * - Excel copy-paste (TSV)
 * - Semicolon separated
 */
export function parseMultiRangeDocument(rawText: string): MultiRangeParseResult {
  if (!rawText || !rawText.trim()) {
    return {
      items: [],
      totalRanges: 0,
      totalNumbers: 0,
      rawLineCount: 0,
      detectedHeaders: null,
    };
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return {
      items: [],
      totalRanges: 0,
      totalNumbers: 0,
      rawLineCount: 0,
      detectedHeaders: null,
    };
  }

  // Detect Delimiter from sample lines
  const sample = lines.slice(0, 8).join('\n');
  let delimiter = ',';
  const tabCount = (sample.match(/\t/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  }

  // Check Line 0 for header indicators
  let rangeCol = -1;
  let prefixCol = -1;
  let numberCol = -1;
  let startIndex = 0;

  const firstCols = splitCsvLine(lines[0], delimiter);
  const isHeaderRow = firstCols.some((col) =>
    /range|prefix|number|msisdn|phone|carrier|network|country/i.test(col)
  );

  if (isHeaderRow) {
    firstCols.forEach((col, idx) => {
      const lower = col.toLowerCase();
      if (/range/i.test(lower)) {
        rangeCol = idx;
      } else if (/prefix|dial|calling|code/i.test(lower)) {
        prefixCol = idx;
      } else if (/number|msisdn|phone|mobile|target/i.test(lower)) {
        numberCol = idx;
      }
    });
    startIndex = 1;
  }

  const rangeMap = new Map<
    string,
    {
      name: string;
      prefix: string;
      countryNote: string;
      numbersSet: Set<string>;
      numbersList: string[];
    }
  >();

  for (let i = startIndex; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    let rangeName = '';
    let prefixCandidate = '';
    let rawNumber = '';

    if (rangeCol >= 0 && numberCol >= 0 && cols[rangeCol] && cols[numberCol]) {
      rangeName = cols[rangeCol];
      prefixCandidate = prefixCol >= 0 && cols[prefixCol] ? cols[prefixCol].replace(/\D/g, '') : '';
      rawNumber = cols[numberCol];
    } else {
      // Auto-detect column roles dynamically based on content heuristics
      // Candidate 1: Phone number (7-18 digits)
      const numIdx = cols.findIndex((c) => {
        const d = c.replace(/\D/g, '');
        return d.length >= 7 && d.length <= 18;
      });

      if (numIdx !== -1) {
        rawNumber = cols[numIdx];

        // Candidate 2: Range name (contains letters, min length 2, not the phone column)
        const nameIdx = cols.findIndex((c, idx) => idx !== numIdx && /[a-zA-Z]/.test(c) && c.length >= 2);
        if (nameIdx !== -1) {
          rangeName = cols[nameIdx];

          // Candidate 3: Prefix (1-4 digits, not the phone column or name column)
          const pfxIdx = cols.findIndex(
            (c, idx) =>
              idx !== numIdx &&
              idx !== nameIdx &&
              /^\+?\d{1,5}$/.test(c.trim())
          );
          if (pfxIdx !== -1) {
            prefixCandidate = cols[pfxIdx].replace(/\D/g, '');
          }
        }
      }
    }

    const cleanNum = rawNumber.replace(/\D/g, '');
    const cleanRange = rangeName.trim();

    if (cleanRange && cleanNum.length >= 5) {
      if (!rangeMap.has(cleanRange)) {
        // Resolve country and prefix
        let finalPrefix = prefixCandidate;
        let finalCountry = 'Worldwide';

        if (!finalPrefix) {
          const detected = detectCountryAndPrefix(cleanNum);
          finalPrefix = detected.prefix;
          finalCountry = detected.country;
        } else {
          const detected = detectCountryAndPrefix(finalPrefix);
          finalCountry = detected.country;
        }

        rangeMap.set(cleanRange, {
          name: cleanRange,
          prefix: finalPrefix || '1',
          countryNote: finalCountry,
          numbersSet: new Set(),
          numbersList: [],
        });
      }

      const entry = rangeMap.get(cleanRange)!;
      if (!entry.numbersSet.has(cleanNum)) {
        entry.numbersSet.add(cleanNum);
        entry.numbersList.push(cleanNum);
      }
    }
  }

  const items: ParsedRangeBatchItem[] = Array.from(rangeMap.values()).map((entry) => ({
    name: entry.name,
    prefix: entry.prefix,
    countryNote: entry.countryNote,
    numbers: entry.numbersList,
    sampleNumbers: entry.numbersList.slice(0, 5),
    totalCount: entry.numbersList.length,
  }));

  const totalNumbers = items.reduce((acc, it) => acc + it.totalCount, 0);

  return {
    items,
    totalRanges: items.length,
    totalNumbers,
    rawLineCount: lines.length,
    detectedHeaders: isHeaderRow ? { rangeCol, prefixCol, numberCol } : null,
  };
}
