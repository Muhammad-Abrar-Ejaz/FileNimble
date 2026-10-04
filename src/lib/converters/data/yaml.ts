/**
 * Secure JSON <-> YAML conversion using the standard 'yaml' package (ISC license).
 *
 * Security controls:
 * - Safe parsing by default (no custom tags, no code execution, no arbitrary class instances).
 * - Maximum input size limit: 10 MiB.
 * - Recursion / nesting depth guard (max 25 levels) to prevent stack overflow/exhaustion.
 */

import { parse, stringify } from 'yaml';

const MAX_YAML_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
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
 * Convert JSON string to formatted YAML.
 */
export function jsonToYaml(jsonText: string): string {
  if (jsonText.length > MAX_YAML_SIZE_BYTES) {
    throw new Error(`JSON file exceeds maximum limit of 10 MiB.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Invalid JSON syntax: ${(err as Error).message}`);
  }

  checkDepth(parsed);
  return stringify(parsed, { indent: 2 });
}

/**
 * Convert YAML string to formatted JSON.
 */
export function yamlToJson(yamlText: string, options: { pretty?: boolean } = {}): string {
  if (yamlText.length > MAX_YAML_SIZE_BYTES) {
    throw new Error(`YAML file exceeds maximum limit of 10 MiB.`);
  }

  let parsed: unknown;
  try {
    // yaml.parse is strictly safe and does not execute arbitrary code
    parsed = parse(yamlText);
  } catch (err) {
    throw new Error(`Invalid YAML syntax: ${(err as Error).message}`);
  }

  if (parsed === undefined) {
    throw new Error('YAML document is empty or could not be parsed.');
  }

  checkDepth(parsed);
  const pretty = options.pretty ?? true;
  return JSON.stringify(parsed, null, pretty ? 2 : undefined);
}
