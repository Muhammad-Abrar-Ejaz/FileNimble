import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { TOOLS_REGISTRY } from '@/config/tools';
import raw from '../../tool_registry.starter.json';
import { canonicalUrl, toolMetadata, publicTools, informationPaths, serializeJsonLd } from './seo';
import { availableFormats, toolsForFormat } from '@/config/formats';
import { trustPages, supportEmail } from '@/config/trust';
import { ToolSeo } from '@/components/seo/PageSeo';
import { TrustPage } from '@/components/seo/TrustPage';
import { PrivacyBadge } from '@/components/tools/PrivacyBadge';
import { getRelatedTools } from './registry';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

afterEach(() => vi.unstubAllEnvs());
describe('Phase 9 public SEO contracts', () => {
  it('has one live canonical per raw record and complete unique metadata', () => {
    const liveRaw = raw.filter(tool => tool.status === 'live');
    expect(new Set(liveRaw.map(tool => tool.slug)).size).toBe(liveRaw.length);
    const live = publicTools();
    for (const key of ['seoTitle', 'seoDescription'] as const) {
      expect(new Set(live.map(tool => tool[key])).size).toBe(live.length);
      for (const tool of live) expect(tool[key]!.length).toBeGreaterThan(20);
    }
    for (const tool of live) {
      expect(existsSync(`src/app/${tool.slug}/page.tsx`), tool.slug).toBe(true);
      expect(toolMetadata(tool.slug).alternates?.canonical).toBe(canonicalUrl(`/${tool.slug}`));
      expect(toolMetadata(tool.slug).robots).toEqual({ index: true, follow: true });
      expect(tool.inputFormats?.length).toBeGreaterThan(0);
      expect(tool.outputFormats?.length).toBeGreaterThan(0);
    }
  });
  it('excludes every non-live canonical, preserving historical raw aliases', () => {
    expect(raw.length).toBeGreaterThan(TOOLS_REGISTRY.length);
    for (const tool of TOOLS_REGISTRY.filter(tool => tool.status !== 'live')) {
      expect(tool.indexable, tool.slug).toBe(false);
      expect(toolMetadata(tool.slug).robots).toEqual({ index: false, follow: true });
      expect(renderToStaticMarkup(<ToolSeo slug={tool.slug} />)).toBe('');
    }
    expect(toolMetadata('missing').robots).toEqual({ index: false, follow: true });
  });
  it('includes exactly public routes and no fabricated freshness', () => {
    const result = sitemap();
    const expected = ['/', ...informationPaths, ...availableFormats().map(format => `/formats/${format}`), ...publicTools().map(tool => `/${tool.slug}`)].map(path => canonicalUrl(path));
    expect(result.map(item => item.url).sort()).toEqual(expected.sort());
    expect(new Set(expected).size).toBe(expected.length);
    expect(result.every(item => !item.lastModified)).toBe(true);
  });
  it('drops query and fragment variants, with consistent social URLs', () => {
    expect(canonicalUrl('/png-to-jpg?download=secret#result')).toBe(canonicalUrl('/png-to-jpg'));
    for (const tool of publicTools()) {
      const metadata = toolMetadata(tool.slug);
      expect(metadata.openGraph?.title).toBe(metadata.title);
      expect(metadata.twitter?.title).toBe(metadata.title);
      expect(metadata.openGraph?.images).toBeDefined();
    }
  });
  it('allows public crawling while excluding internal areas', () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(true);
    const rule = (rules as { allow: string; disallow: string[] }[])[0];
    expect(rule.allow).toBe('/');
    expect(rule.disallow).toContain('/api/');
    expect(rule.disallow).toContain('/download/');
    expect(rule.disallow).not.toContain('/');
  });
  it('keeps server privacy distinct and disabled backend capabilities nonindexable', () => {
    const source = readFileSync('worker/app/capabilities.py', 'utf8');
    for (const tool of publicTools().filter(tool => tool.processingMode === 'server')) {
      expect(tool.privacyLabel).not.toMatch(/Runs in browser/i);
      expect(tool.seoDescription).not.toMatch(/zero.*upload|browser.side privacy/i);
      // Parse each capability call as source text without importing the backend stack.
      const match = source.match(new RegExp('"' + tool.slug + '": Capability\\(([\\s\\S]*?)\\),'));
      expect(match?.[1], tool.slug).toContain('enabled=True');
    }
    expect(renderToStaticMarkup(<PrivacyBadge mode="server" />)).not.toContain('Runs in browser');
    expect(renderToStaticMarkup(<PrivacyBadge mode="client" />)).toContain('Runs in browser');
  });
  it('uses real related routes and format hubs without jpeg aliases', () => {
    expect(availableFormats()).not.toContain('jpeg');
    for (const format of availableFormats()) expect(toolsForFormat(format).length).toBeGreaterThan(0);
    for (const tool of publicTools()) {
      const related = getRelatedTools(tool);
      expect(new Set(related.map(item => item.slug)).size).toBe(related.length);
      expect(related.every(item => item.status === 'live' && item.slug !== tool.slug)).toBe(true);
    }
  });
  it('emits parseable matching schema without offers or unsafe script delimiters', () => {
    expect(serializeJsonLd({ text: '</script><script>alert(1)</script>' })).not.toContain('<');
    for (const tool of publicTools()) {
      const html = renderToStaticMarkup(<ToolSeo slug={tool.slug} />);
      const entities = [...html.matchAll(/<script[^>]*>(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
      expect(entities.map(entity => entity['@type'])).toEqual(['BreadcrumbList', 'WebApplication']);
      expect(entities[1].url).toBe(canonicalUrl(`/${tool.slug}`));
      expect(entities[1].name).toBe(tool.title);
      expect(entities[1].offers).toBeUndefined();
      expect(entities[1].aggregateRating).toBeUndefined();
    }
  });
  it('renders honest trust pages and operator-configured contact only', () => {
    vi.stubEnv('FILENIMBLE_SUPPORT_EMAIL', '');
    expect(renderToStaticMarkup(<TrustPage slug="contact" />)).toContain('has not been configured');
    for (const slug of Object.keys(trustPages) as (keyof typeof trustPages)[]) {
      const html = renderToStaticMarkup(<TrustPage slug={slug} />);
      expect(html.match(/<h1/g)).toHaveLength(1);
      expect(html).toContain('/tools');
    }
    vi.stubEnv('FILENIMBLE_SUPPORT_EMAIL', 'test@example.com');
    expect(supportEmail()).toBe('test@example.com');
    vi.stubEnv('FILENIMBLE_SUPPORT_EMAIL', 'test@example.com?subject=inject');
    expect(supportEmail()).toBeUndefined();
  });
});
