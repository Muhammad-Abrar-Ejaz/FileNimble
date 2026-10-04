import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { TOOLS_REGISTRY, TOOLS_BY_SLUG } from '@/config/tools';
import type { ToolRecord } from '@/types/tool';

export const isIndexableTool = (tool: ToolRecord) => tool.status === 'live' && tool.indexable;
export const publicTools = () => TOOLS_REGISTRY.filter(isIndexableTool);

/** Public URLs never inherit request queries, fragments, or proxy host headers. */
export function canonicalUrl(path = '/') {
  const url = new URL(path.split(/[?#]/)[0], new URL(siteConfig.url).origin);
  url.search = '';
  url.hash = '';
  return url.href;
}

export function pageMetadata(path: string, title: string, description: string, index = true): Metadata {
  const url = canonicalUrl(path);
  return {
    title, description, alternates: { canonical: url }, robots: { index, follow: true },
    openGraph: { type: 'website', title, description, url, siteName: siteConfig.name,
      images: [{ url: canonicalUrl(siteConfig.ogImage), alt: 'FileNimble logo' }] },
    twitter: { card: 'summary', title, description, images: [canonicalUrl(siteConfig.ogImage)] },
  };
}

export function toolMetadata(slug: string): Metadata {
  const tool = TOOLS_BY_SLUG.get(slug);
  if (!tool) return { title: 'Tool not found | FileNimble', robots: { index: false, follow: true } };
  if (tool.status !== 'live') return pageMetadata(`/${slug}`, `${tool.title || slug} — Planned | FileNimble`, 'This converter is not available. Browse available FileNimble tools while qualification work remains pending.', false);
  return pageMetadata(`/${slug}`, tool.seoTitle || `${tool.title} — Planned | FileNimble`,
    tool.seoDescription || 'This tool is not available yet.', isIndexableTool(tool));
}

export const trustPaths = ['/about', '/privacy', '/terms', '/contact'];
export const informationPaths = [...trustPaths, '/tools', '/formats'];

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
