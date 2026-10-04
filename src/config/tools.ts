import rawTools from "../../tool_registry.starter.json";
import { ToolRecord, ToolRecordSchema } from "@/types/tool";

/**
 * Parse and validate all tools from the starter registry.
 * Deduplicates entries by slug, keeping the first occurrence.
 */
function loadRegistry(): ToolRecord[] {
  const seenSlugs = new Set<string>();
  const tools: ToolRecord[] = [];

  for (const tool of rawTools) {
    const parsed = ToolRecordSchema.safeParse(tool);
    if (!parsed.success) {
      console.warn(`[ToolRegistry] Invalid tool record ${tool.id}:`, parsed.error.issues);
      continue;
    }
    // Deduplicate by slug — the starter JSON has a known duplicate for pdf-to-text
    if (seenSlugs.has(parsed.data.slug)) {
      console.warn(
        `[ToolRegistry] Skipping duplicate slug "${parsed.data.slug}" (id: ${parsed.data.id})`
      );
      continue;
    }
    seenSlugs.add(parsed.data.slug);
    tools.push(parsed.data);
  }

  return tools;
}

export const TOOLS_REGISTRY: ToolRecord[] = loadRegistry();

/**
 * Returns a map of tools keyed by slug for O(1) route lookup.
 */
export const TOOLS_BY_SLUG = new Map<string, ToolRecord>(
  TOOLS_REGISTRY.map((t) => [t.slug, t])
);

/**
 * Returns a map of tools keyed by ID.
 */
export const TOOLS_BY_ID = new Map<string, ToolRecord>(
  TOOLS_REGISTRY.map((t) => [t.id, t])
);
