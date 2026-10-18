import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readProjectFile(path: string) {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

describe('public processing and privacy copy', () => {
  const homepage = readProjectFile('src/app/page.tsx');
  const toolsDirectory = readProjectFile('src/app/tools/page.tsx');
  const header = readProjectFile('src/components/layout/Header.tsx');
  const mobileNav = readProjectFile('src/components/layout/MobileNav.tsx');
  const footer = readProjectFile('src/components/layout/Footer.tsx');
  const uploader = readProjectFile('src/components/uploader/UniversalUploader.tsx');
  const privacyBadge = readProjectFile('src/components/tools/PrivacyBadge.tsx');
  const stateView = readProjectFile('src/components/converter/ConverterStateView.tsx');
  const imageConverter = readProjectFile('src/components/converter/image/SharedImageConverterClient.tsx');
  const aiPage = readProjectFile('src/components/ai/AiToolPage.tsx');
  const imagePages = [
    'src/app/image-resize/page.tsx',
    'src/app/image-compress/page.tsx',
    'src/app/image-crop/page.tsx',
    'src/app/jpg-to-png/page.tsx',
    'src/app/webp-to-jpg/page.tsx',
  ].map(readProjectFile).join('\n');
  const aiRouteMetadata = [
    'src/app/ai-document-summarizer/page.tsx',
    'src/app/translate-document/page.tsx',
    'src/app/pdf-to-structured-markdown/page.tsx',
  ].map(readProjectFile).join('\n');
  const plannedToolPage = readProjectFile('src/components/converter/document/DocumentToolPage.tsx');
  const trust = readProjectFile('src/config/trust.ts');
  const toolRegistry = JSON.parse(readProjectFile('tool_registry.starter.json')) as Array<{
    slug: string;
    category?: string;
    status: string;
    indexable: boolean;
    processingMode?: string;
    description?: string;
    seoDescription?: string;
    privacyLabel?: string;
  }>;

  it('distinguishes the supported server conversions from planned tools', () => {
    const productionTools = JSON.parse(readProjectFile('worker/production_tools.json')) as string[];
    expect([...productionTools].sort()).toEqual(['tar-to-zip', 'zip-to-tar']);
    expect(homepage).toContain('TAR to ZIP and ZIP to TAR');
    expect(homepage).toContain('limited queue');
    expect(homepage).toContain('Tools marked Planned are not available in this release');
    expect(toolsDirectory).toContain('only server conversions in this release are TAR to ZIP and ZIP to TAR');
  });

  it('does not make absolute privacy or queue promises across shared UI copy', () => {
    const sharedCopy = [homepage, header, mobileNav, footer, uploader, privacyBadge, stateView, imageConverter, imagePages].join('\n');
    const catalogCopy = toolRegistry.map((tool) => [tool.description, tool.seoDescription, tool.privacyLabel].join(' ')).join('\n');
    expect(sharedCopy).not.toMatch(/100%\s+(?:client-side\s+)?privacy|privacy guaranteed/i);
    expect(sharedCopy).not.toMatch(/files are never stored or tracked|waiting queues/i);
    expect(sharedCopy).not.toMatch(/no permanent storage/i);
    expect(catalogCopy).not.toMatch(/100%\s+private|privacy guaranteed/i);
    expect(sharedCopy).not.toMatch(/100%\s+private|remain completely private|images remain private|never leave your browser/i);
    expect(aiPage).toMatch(/AI processing is disabled in this release/i);
    expect(aiRouteMetadata).toMatch(/AI processing is disabled in this release/i);
    expect(plannedToolPage).toMatch(/cannot process or upload files/i);
  });

  it('states the implemented expiry and cleanup behavior without promising instant deletion', () => {
    expect(trust).toMatch(/abandoned jobs expire one hour after creation/i);
    expect(trust).toContain('source uploads become eligible for cleanup after the upload window closes');
    expect(trust).toMatch(/completed outputs expire one hour after completion/i);
    expect(trust).toContain('outages can delay physical deletion');
    expect(trust).toContain('scheduled for removal seven days after confirmed artifact removal; cleanup delays may extend that period');
  });

  it('keeps OCR and AI catalog entries unavailable and non-indexable', () => {
    const unavailableSlugs = ['image-to-text', 'pdf-to-text', 'ocr-pdf'];
    for (const slug of unavailableSlugs) {
      const record = toolRegistry.find((tool) => tool.slug === slug && tool.processingMode === 'server');
      expect(record, `${slug} registry entry`).toBeDefined();
      expect(record?.status).toBe('planned');
      expect(record?.indexable).toBe(false);
      expect(record?.description).toMatch(/unavailable in this release/i);
      expect(record?.privacyLabel).toBe('Unavailable in this release');
    }

    const aiTools = toolRegistry.filter((tool) => tool.category === 'ai');
    expect(aiTools.length).toBeGreaterThan(0);
    for (const tool of aiTools) {
      expect(tool.status).toBe('planned');
      expect(tool.indexable).toBe(false);
      expect(tool.description).toMatch(/AI processing is disabled/i);
      expect(tool.privacyLabel).toBe('AI processing disabled in this release');
    }
  });
});
