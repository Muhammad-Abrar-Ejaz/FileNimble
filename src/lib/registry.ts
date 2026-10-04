import { TOOLS_REGISTRY, TOOLS_BY_SLUG, TOOLS_BY_ID } from "@/config/tools";
import { ToolCategory, ToolRecord } from "@/types/tool";

export function getAllTools(): ToolRecord[] {
  return TOOLS_REGISTRY;
}

export function getToolBySlug(slug: string): ToolRecord | undefined {
  return TOOLS_BY_SLUG.get(slug);
}

export function getToolById(id: string): ToolRecord | undefined {
  return TOOLS_BY_ID.get(id);
}

export function getToolsByCategory(category: ToolCategory): ToolRecord[] {
  return TOOLS_REGISTRY.filter((t) => t.category === category);
}

export function getLiveTools(): ToolRecord[] {
  return TOOLS_REGISTRY.filter((t) => t.status === "live");
}

export function getRelatedTools(tool: ToolRecord, limit = 4): ToolRecord[] {
  const preferred = (tool.relatedTools || []).map(slug => getToolBySlug(slug));
  const fallback = TOOLS_REGISTRY.filter(candidate => candidate.category === tool.category);
  const seen = new Set([tool.slug]);
  return [...preferred, ...fallback].filter((candidate): candidate is ToolRecord => {
    if (!candidate || candidate.status !== 'live' || !candidate.indexable || seen.has(candidate.slug)) return false;
    seen.add(candidate.slug);
    return true;
  }).slice(0, limit);
}

export function searchTools(query: string): ToolRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return TOOLS_REGISTRY;

  return TOOLS_REGISTRY.filter((t) => {
    const slugMatch = t.slug.toLowerCase().includes(q);
    const idMatch = t.id.toLowerCase().includes(q);
    const titleMatch = t.title?.toLowerCase().includes(q);
    const categoryMatch = t.category.toLowerCase().includes(q);
    return slugMatch || idMatch || titleMatch || categoryMatch;
  });
}
