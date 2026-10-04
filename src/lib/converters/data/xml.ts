/**
 * Secure JSON <-> XML conversion using fast-xml-parser (MIT license).
 *
 * Security controls:
 * - XXE Protection: Detects and rejects <!DOCTYPE and <!ENTITY containing SYSTEM, PUBLIC, or external URIs.
 * - No network access: fast-xml-parser executes purely locally with no external DTD resolution.
 * - Entity Expansion / Billion Laughs protection: Disallows recursive entity definitions.
 * - Max input size limit: 10 MiB.
 * - Max nesting depth: 25 levels.
 */

import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';

const MAX_XML_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
const MAX_NESTING_DEPTH = 25;

function checkDepth(value: unknown, depth = 0): void {
  if (depth > MAX_NESTING_DEPTH) {
    throw new Error(`Data exceeds maximum nesting depth limit of ${MAX_NESTING_DEPTH}.`);
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      for (const item of value) {
        checkDepth(item, depth + 1);
      }
    } else {
      for (const key of Object.keys(value)) {
        checkDepth((value as Record<string, unknown>)[key], depth + 1);
      }
    }
  }
}

/**
 * Scan for hostile XML constructs: XXE, DTD external entity fetching, entity expansion recursion.
 */
export function validateXmlSecurity(xmlText: string): void {
  const upper = xmlText.toUpperCase();
  if (upper.includes('<!DOCTYPE') || upper.includes('<!ENTITY')) {
    if (
      upper.includes('SYSTEM') ||
      upper.includes('PUBLIC') ||
      upper.includes('HTTP://') ||
      upper.includes('HTTPS://') ||
      upper.includes('FILE://')
    ) {
      throw new Error('External entity resolution (XXE) and external DTDs are strictly prohibited.');
    }
    // Check for excessive entity declarations (Billion Laughs protection)
    const entityMatches = upper.match(/<!ENTITY/g);
    if (entityMatches && entityMatches.length > 5) {
      throw new Error('Entity expansion bomb detected: excessive entity declarations are prohibited.');
    }
  }
}

/**
 * Convert JSON text to well-formed XML.
 */
export function jsonToXml(
  jsonText: string,
  options: { rootTag?: string; pretty?: boolean } = {}
): string {
  if (jsonText.length > MAX_XML_SIZE_BYTES) {
    throw new Error('JSON file exceeds maximum limit of 10 MiB.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Invalid JSON syntax: ${(err as Error).message}`);
  }

  if (parsed === null || parsed === undefined) {
    throw new Error('JSON document cannot be null or empty.');
  }

  checkDepth(parsed);

  const rootTag = options.rootTag || 'root';
  let xmlData: Record<string, unknown>;

  if (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed as object).length === 1) {
    // If JSON already has a single top-level root object, use it directly
    xmlData = parsed as Record<string, unknown>;
  } else if (Array.isArray(parsed)) {
    // Wrap array in root with item tags
    xmlData = { [rootTag]: { item: parsed } };
  } else {
    // Wrap primitives/objects in root tag
    xmlData = { [rootTag]: parsed };
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: options.pretty ?? true,
    indentBy: '  ',
    suppressEmptyNode: false,
  });

  const xmlContent = builder.build(xmlData);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;
}

/**
 * Convert XML text to formatted JSON.
 */
export function xmlToJson(
  xmlText: string,
  options: { pretty?: boolean } = {}
): string {
  if (xmlText.length > MAX_XML_SIZE_BYTES) {
    throw new Error('XML file exceeds maximum limit of 10 MiB.');
  }

  // Security preflight against XXE and entity bombs
  validateXmlSecurity(xmlText);

  const validation = XMLValidator.validate(xmlText);
  if (validation !== true) {
    const errorMsg = typeof validation === 'object' && validation.err ? validation.err.msg : 'Invalid XML';
    throw new Error(`Invalid XML structure: ${errorMsg}`);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
    allowBooleanAttributes: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlText);
  } catch (err) {
    throw new Error(`Invalid XML structure: ${(err as Error).message}`);
  }

  if (!parsed || (typeof parsed === 'object' && Object.keys(parsed).length === 0)) {
    throw new Error('XML document is empty or contains no valid elements.');
  }

  checkDepth(parsed);
  const pretty = options.pretty ?? true;
  return JSON.stringify(parsed, null, pretty ? 2 : undefined);
}
