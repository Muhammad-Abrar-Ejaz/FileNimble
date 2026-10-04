import { describe, expect, it } from 'vitest';
import { OCR_TOOLS } from './ocrTools';
import { getToolBySlug } from '@/lib/registry';
import sitemap from '@/app/sitemap';

describe('OCR publication contract', () => {
  it('has precisely the three documented OCR operations with unique editorial content', () => {
    expect(OCR_TOOLS.map(tool => tool.slug)).toEqual(['image-to-text', 'pdf-to-text', 'ocr-pdf']);
    expect(new Set(OCR_TOOLS.map(tool => tool.title)).size).toBe(3);
    expect(new Set(OCR_TOOLS.map(tool => tool.description)).size).toBe(3);
  });
  it('uses server processing and bounded English-only claims', () => {
    for (const tool of OCR_TOOLS) {
      expect(getToolBySlug(tool.slug)?.processingMode).toBe('server');
      expect(tool.limitations).toContain('English');
      expect(tool.limitations).toContain('10 MiB');
      expect(tool.faqs.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('includes only activated OCR routes in sitemap, once each', () => {
    for (const tool of OCR_TOOLS) {
      const matches = sitemap().filter(entry => new URL(entry.url).pathname === '/' + tool.slug);
      expect(matches.length).toBe(getToolBySlug(tool.slug)?.status === 'live' ? 1 : 0);
    }
  });
});
