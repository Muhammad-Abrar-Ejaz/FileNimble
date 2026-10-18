import { test, expect } from '@playwright/test';
import registry from '../tool_registry.starter.json';

test('trust pages, keyboard links and format navigation remain usable', async ({ page }) => {
  // Format hubs are intentionally generated only when a live, indexable tool
  // supports that format. DOCX currently has no released converter.
  for (const path of ['/about', '/privacy', '/terms', '/contact', '/tools', '/formats', '/formats/pdf', '/formats/md']) {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
    expect(new URL(canonical!).pathname).toBe(path);
    for (const text of await page.locator('script[type="application/ld+json"]').allTextContents()) {
      const schema = JSON.parse(text);
      expect(schema['@type']).toBe('BreadcrumbList');
      expect(schema.itemListElement.at(-1).item).toBe(canonical);
    }
  }
  await page.goto('/privacy');
  await expect(page.getByText(/outages can delay physical deletion/i)).toBeVisible();
  await expect(page.getByText(/seven days after confirmed artifact removal/i)).toBeVisible();
  const directory = page.getByRole('link', { name: 'Available conversion tools', exact: true });
  await directory.focus();
  expect(await directory.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tools$/);
  const live = registry.filter(tool => tool.status === 'live' && tool.indexable);
  for (const tool of live) await expect(page.locator(`main a[href="/${tool.slug}"]`)).toHaveCount(1);
  await page.getByRole('link', { name: 'Browse by file format' }).click();
  await page.getByRole('link', { name: 'PDF', exact: true }).click();
  await expect(page).toHaveURL(/\/formats\/pdf$/);
});

test('planned pages, aliases and private endpoints do not become indexable tools', async ({ page, request }) => {
  for (const slug of ['word-to-pdf', 'compress-pdf', 'html-to-pdf', 'heic-to-jpg']) {
    await page.goto(`/${slug}`);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toContainText('Planned');
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  }
  for (const path of ['/formats/not-a-format', '/formats/jpeg', '/nonexistent-converter']) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('noindex');
  }
  const response = await request.get('/api/v1/not-a-real-endpoint');
  expect(response.headers()['x-robots-tag']).toContain('noindex');
  const rules = await (await request.get('/robots.txt')).text();
  expect(rules).toContain('Allow: /');
  expect(rules).toContain('Disallow: /api/');
  expect(rules).toContain('Disallow: /results/');
});

test('converter schema and canonical survive query variants without duplicate entities', async ({ page }) => {
  // Planned tools remain noindex and intentionally have no structured data.
  // Exercise the schema assertions against released, indexable tools only.
  for (const slug of ['png-to-jpg', 'merge-pdf', 'csv-to-json', 'tar-to-zip']) {
    await page.goto(`/${slug}?source=test#example`);
    const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
    expect(new URL(canonical!).pathname).toBe(`/${slug}`);
    expect(new URL(canonical!).search).toBe('');
    const data = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(text => JSON.parse(text));
    expect(data.map(item => item['@type']).sort()).toEqual(['BreadcrumbList', 'WebApplication']);
    const app = data.find(item => item['@type'] === 'WebApplication');
    expect(app.url).toBe(canonical);
    expect(app.offers).toBeUndefined();
    expect(app.aggregateRating).toBeUndefined();
    expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toContain('/brand/filenimble-logo.png');
  }
  await expect(page.getByRole('heading', { name: 'Temporary server processing' })).toBeVisible();
  const intro = page.locator('h1').locator('..');
  await expect(intro.getByText('Temporary server processing')).toBeVisible();
  await expect(intro.getByText('Runs in browser')).toHaveCount(0);
});
