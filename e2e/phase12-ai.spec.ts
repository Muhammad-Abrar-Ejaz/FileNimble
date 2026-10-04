import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const selectedProjects = new Set(['chromium', 'Mobile Chrome']);

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!selectedProjects.has(testInfo.project.name), 'Phase 12 UI matrix targets Desktop Chromium and Mobile Chrome.');
  await page.route('**/api/v1/ai/status', route => route.fulfill({ json: { enabled: true }, headers: { 'cache-control': 'no-store' } }));
});

test('summary requires explicit external-AI consent and downloads plain text safely', async ({ page }, testInfo) => {
  const requests: Array<{ url: string; body: string | null }> = [];
  await page.route('**/api/v1/ai/process', async route => {
    requests.push({ url: route.request().url(), body: route.request().postData() });
    await route.fulfill({ json: { result: '<script>not executed</script>Short source-faithful summary.', provider: 'fake' } });
  });
  await page.goto('/ai-document-summarizer');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const sitemap = await page.request.get('/sitemap.xml');
  expect(await sitemap.text()).not.toContain('ai-document-summarizer');
  const input = page.getByRole('textbox', { name: 'Document text' });
  await input.fill('A bounded report with the 2026 test result.');
  const action = page.getByRole('button', { name: 'Summarize text' });
  await expect(action).toBeDisabled();
  const consent = page.getByRole('checkbox', { name: /sent to the configured external AI provider/ });
  if (testInfo.project.name === 'chromium') {
    await consent.focus(); await consent.press('Space');
    await action.focus(); await action.press('Enter');
  } else {
    await consent.check(); await action.click();
  }
  const result = page.getByRole('region', { name: 'Generated result text' });
  await expect(result).toContainText('<script>not executed</script>');
  if (testInfo.project.name === 'chromium') await expect(result).toBeFocused();
  await expect(result.locator('script')).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toContain('/api/v1/ai/process');
  expect(JSON.parse(requests[0].body || '{}')).toEqual({ tool: 'ai-document-summarizer', text: 'A bounded report with the 2026 test result.' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download text' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('document-summary.txt');
  const stream = await download.createReadStream();
  let output = '';
  for await (const chunk of stream) output += chunk.toString();
  expect(output).toBe('<script>not executed</script>Short source-faithful summary.');
  if (testInfo.project.name === 'Mobile Chrome') expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('translation sends only the chosen text and target language', async ({ page }) => {
  const submitted: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/ai/process', async route => {
    submitted.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ json: { result: 'Bonjour.', provider: 'fake' } });
  });
  await page.goto('/translate-document');
  await page.getByRole('textbox', { name: 'Document text' }).fill('Good morning.');
  await page.getByLabel('Translate into').selectOption('French');
  await page.getByRole('checkbox', { name: /sent to the configured external AI provider/ }).check();
  await page.getByRole('button', { name: 'Translate text' }).click();
  await expect(page.getByRole('region', { name: 'Generated result text' })).toHaveText('Bonjour.');
  expect(submitted[0]?.tool).toBe('translate-document');
  expect(submitted[0]?.text).toBe('Good morning.');
  expect(submitted[0]?.language).toBe('French');
});

test('PDF bytes stay local and only bounded extracted text reaches the mocked provider', async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/v1/ai/process', async route => {
    submitted = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ json: { result: '# Project Notes\n\n- Keep the test fixture local.', provider: 'fake' } });
  });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([612, 792]).drawText('Project Notes. Keep the test fixture local.', { x: 48, y: 730, size: 14, font });
  const bytes = Buffer.from(await pdf.save());
  await page.goto('/pdf-to-structured-markdown');
  await page.locator('#ai-pdf').setInputFiles({ name: 'private-fixture-name.pdf', mimeType: 'application/pdf', buffer: bytes });
  await expect(page.getByText(/Extracted text from 1 PDF page locally/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('textbox', { name: 'Document text' })).toContainText('Project Notes');
  await page.getByRole('checkbox', { name: /sent to the configured external AI provider/ }).check();
  await page.getByRole('button', { name: 'Create Markdown' }).click();
  await expect(page.getByRole('region', { name: 'Generated result text' })).toContainText('Keep the test fixture local.');
  expect(submitted).toEqual({ tool: 'pdf-to-structured-markdown', text: expect.stringContaining('Project Notes') });
  expect(JSON.stringify(submitted)).not.toContain('private-fixture-name');
  expect(JSON.stringify(submitted)).not.toContain('%PDF-');
});
