/**
 * High-performance, secure, RFC 4180 compliant CSV parser and serializer.
 *
 * Security controls:
 * - Spreadsheet Formula Injection Prevention: prepends single quote (') to values
 *   beginning with '=', '+', '-', '@', '\t', or '\r' when exporting to CSV/spreadsheet formats.
 * - Max row limit: 50,000 rows.
 * - Max column limit: 1,000 columns.
 * - Max text size: 10 MiB.
 * - Handles UTF-8 BOM, quoted fields, embedded newlines, and escaped quotes.
 */

export interface CsvParseOptions {
  delimiter?: string;
  hasHeaders?: boolean;
  maxRows?: number;
  maxCols?: number;
  trimValues?: boolean;
}

export interface CsvSerializeOptions {
  delimiter?: string;
  escapeFormulas?: boolean;
  newline?: '\r\n' | '\n';
}

export interface CsvToJsonOptions extends CsvParseOptions {
  parseNumbers?: boolean;
  parseBooleans?: boolean;
  parseNulls?: boolean;
}

export interface JsonToCsvOptions extends CsvSerializeOptions {
  flattenDepth?: number;
}

const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
const DEFAULT_MAX_ROWS = 50000;
const DEFAULT_MAX_COLS = 1000;
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Auto-detect delimiter from the first few lines of CSV text.
 */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 4096);
  const candidates = [',', ';', '\t', '|'];
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };

  let inQuotes = false;
  for (let i = 0; i < sample.length; i++) {
    const char = sample[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && counts[char] !== undefined) {
      counts[char]++;
    }
  }

  let bestDelimiter = ',';
  let maxCount = 0;
  for (const delim of candidates) {
    if (counts[delim] > maxCount) {
      maxCount = counts[delim];
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Parse raw CSV text into a 2D array of strings.
 */
export function parseCsv(text: string, options: CsvParseOptions = {}): string[][] {
  if (text.length > MAX_CSV_SIZE_BYTES) {
    throw new Error(`CSV file exceeds maximum limit of 10 MiB (${(text.length / 1024 / 1024).toFixed(1)} MiB).`);
  }

  // Strip UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  const delimiter = options.delimiter || detectDelimiter(cleanText);
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const maxCols = options.maxCols ?? DEFAULT_MAX_COLS;
  const trimValues = options.trimValues ?? false;

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;
  const len = cleanText.length;

  while (i < len) {
    const char = cleanText[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && cleanText[i + 1] === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // End of quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }

      if (char === delimiter) {
        currentRow.push(trimValues ? currentCell.trim() : currentCell);
        currentCell = '';
        if (currentRow.length > maxCols) {
          throw new Error(`CSV exceeds maximum column limit of ${maxCols}.`);
        }
        i++;
        continue;
      }

      if (char === '\r') {
        if (i + 1 < len && cleanText[i + 1] === '\n') {
          i++; // Skip \r in \r\n
        }
        currentRow.push(trimValues ? currentCell.trim() : currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        if (rows.length > maxRows) {
          throw new Error(`CSV exceeds maximum row limit of ${maxRows}.`);
        }
        i++;
        continue;
      }

      if (char === '\n') {
        currentRow.push(trimValues ? currentCell.trim() : currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        if (rows.length > maxRows) {
          throw new Error(`CSV exceeds maximum row limit of ${maxRows}.`);
        }
        i++;
        continue;
      }

      currentCell += char;
      i++;
    }
  }

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(trimValues ? currentCell.trim() : currentCell);
    rows.push(currentRow);
  }

  // Drop trailing single empty row if input ended with newline
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (lastRow.length === 1 && lastRow[0] === '') {
      rows.pop();
    }
  }

  return rows;
}

/**
 * Escape a cell value according to RFC 4180 and formula injection security policy.
 */
export function escapeCsvCell(
  value: unknown,
  delimiter = ',',
  escapeFormulas = true
): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Security: Neutralize formula injection
  if (escapeFormulas && str.length > 0) {
    const firstChar = str[0];
    if (FORMULA_PREFIXES.includes(firstChar)) {
      str = `'${str}`;
    }
  }

  const needsQuotes =
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r');

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serialize a 2D array or array of objects to RFC 4180 CSV text.
 */
export function serializeCsv(
  data: Array<Record<string, unknown>> | Array<unknown[]>,
  options: CsvSerializeOptions = {}
): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const delimiter = options.delimiter ?? ',';
  const escapeFormulas = options.escapeFormulas ?? true;
  const newline = options.newline ?? '\r\n';

  if (Array.isArray(data[0])) {
    // Array of arrays
    const rows = data as Array<unknown[]>;
    return rows
      .map(row => row.map(cell => escapeCsvCell(cell, delimiter, escapeFormulas)).join(delimiter))
      .join(newline);
  }

  // Array of objects
  const records = data as Array<Record<string, unknown>>;
  const headerSet = new Set<string>();
  for (const record of records) {
    if (record && typeof record === 'object') {
      for (const key of Object.keys(record)) {
        headerSet.add(key);
      }
    }
  }
  const headers = Array.from(headerSet);

  const headerLine = headers
    .map(h => escapeCsvCell(h, delimiter, escapeFormulas))
    .join(delimiter);

  const bodyLines = records.map(record => {
    return headers
      .map(h => escapeCsvCell(record?.[h], delimiter, escapeFormulas))
      .join(delimiter);
  });

  return [headerLine, ...bodyLines].join(newline);
}

/**
 * Convert CSV text to JSON format.
 */
export function csvToJson(
  csvText: string,
  options: CsvToJsonOptions = {}
): string {
  const rows = parseCsv(csvText, options);
  if (rows.length === 0) {
    return '[]';
  }

  const hasHeaders = options.hasHeaders ?? true;
  const parseNumbers = options.parseNumbers ?? true;
  const parseBooleans = options.parseBooleans ?? true;
  const parseNulls = options.parseNulls ?? true;

  const coerce = (val: string): unknown => {
    if (val === '') return '';
    if (parseNulls && (val.toLowerCase() === 'null')) return null;
    if (parseBooleans) {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    if (parseNumbers && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(val)) {
      const num = Number(val);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        return num;
      }
    }
    return val;
  };

  if (!hasHeaders) {
    const table = rows.map(row => row.map(cell => coerce(cell)));
    return JSON.stringify(table, null, 2);
  }

  const headers = rows[0].map((h, idx) => h.trim() || `column_${idx + 1}`);
  const result: Array<Record<string, unknown>> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const record: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const cellValue = c < row.length ? row[c] : '';
      record[headers[c]] = coerce(cellValue);
    }
    result.push(record);
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Safely flatten a nested object up to maxDepth.
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
  depth = 0,
  maxDepth = 3
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      depth < maxDepth
    ) {
      Object.assign(
        flattened,
        flattenObject(value as Record<string, unknown>, newKey, depth + 1, maxDepth)
      );
    } else if (Array.isArray(value)) {
      flattened[newKey] = JSON.stringify(value);
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

/**
 * Convert JSON text to RFC 4180 CSV text.
 */
export function jsonToCsv(
  jsonText: string,
  options: JsonToCsvOptions = {}
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Invalid JSON syntax: ${(err as Error).message}`);
  }

  if (parsed === null || parsed === undefined) {
    throw new Error('JSON document cannot be null or empty.');
  }

  const maxDepth = options.flattenDepth ?? 3;

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return '';
    }

    if (Array.isArray(parsed[0])) {
      // Array of arrays
      return serializeCsv(parsed as Array<unknown[]>, options);
    }

    // Array of objects or primitives
    const flatRecords: Array<Record<string, unknown>> = parsed.map((item, index) => {
      if (item !== null && typeof item === 'object') {
        return flattenObject(item as Record<string, unknown>, '', 0, maxDepth);
      }
      return { value: item, index };
    });

    return serializeCsv(flatRecords, options);
  }

  if (typeof parsed === 'object') {
    // Single object: serialize as single row with headers
    const flat = flattenObject(parsed as Record<string, unknown>, '', 0, maxDepth);
    return serializeCsv([flat], options);
  }

  throw new Error('Unsupported JSON structure. Expected a JSON array or object.');
}
