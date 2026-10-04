import { test, expect } from '@playwright/test';
import registry from '../tool_registry.starter.json';

const canonicalRegistry = registry.filter((tool, index) => registry.findIndex(candidate => candidate.slug === tool.slug) === index);
const live = canonicalRegistry.filter(tool => tool.status === 'live' && tool.indexable);

test('all live pages have distinct metadata, content, valid sitemap entries, and responsive layouts', async ({ page, request }) => {
  test.setTimeout(120000);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const entries = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]).pathname);
  expect(new Set(entries).size).toBe(entries.length);
  for (const path of ['/', '/about', '/privacy', '/terms', '/contact', '/tools', '/formats', ...live.map(tool => `/${tool.slug}`)]) expect(entries).toContain(path);
  for (const tool of canonicalRegistry.filter(tool => tool.status !== 'live')) expect(entries).not.toContain(`/${tool.slug}`);
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const tool of live) {
    const response = await page.goto(`/${tool.slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    const title = await page.title();
    expect(title.match(/FileNimble/g)).toHaveLength(1);
    const socialTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', socialTitle!);
    expect(titles.has(title)).toBe(false); titles.add(title);
    const description = await page.locator('meta[name=description]').getAttribute('content');
    expect(description!.length).toBeGreaterThan(60);
    expect(descriptions.has(description!)).toBe(false); descriptions.add(description!);
    expect(new URL((await page.locator('link[rel=canonical]').getAttribute('href'))!).pathname).toBe(`/${tool.slug}`);
    expect(await page.locator('meta[name=robots]').getAttribute('content')).not.toContain('noindex');
    await expect(page.getByRole('heading', { name: /Frequently Asked Questions/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Related Tools|More Image & Document Tools/i })).toBeVisible();
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tool.slug} at ${width}px`).toBe(true);
    }
  }
});

test('navigation targets exist and category links select the matching tools', async ({ page, request }) => {
  await page.goto('/');
  const links = await page.locator('a[href]').evaluateAll(anchors => [...new Set(anchors.map(anchor => anchor.getAttribute('href')!))]);
  for (const href of links.filter(href => href.startsWith('/') || href.startsWith('#'))) {
    const url = new URL(href, page.url());
    if (url.pathname === '/' && url.hash) {
      expect(await page.locator(`[id="${url.hash.slice(1)}"]`).count(), href).toBe(1);
    } else {
      expect((await request.get(url.pathname)).status(), href).toBe(200);
    }
  }
  await page.locator('#categories').getByRole('link', { name: /Explore Image Tools/ }).click();
  await expect(page.locator('button#image')).toHaveAttribute('aria-pressed', 'true');
  const discovery = page.getByRole('region', { name: 'Tool search and discovery' });
  await expect(discovery.getByRole('link', { name: /PNG to JPG.*Ready/ })).toBeVisible();
  await page.goto('/png-to-jpg');
  await page.locator('footer').getByRole('link', { name: 'Documents & Data', exact: true }).click();
  await expect(page.locator('button#document_data')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('footer').getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
});

test('mobile menu traps and restores keyboard focus, including a desktop resize', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open mobile navigation menu' });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();
  const controls = dialog.locator('a[href], button');
  await controls.last().focus(); await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(controls.last()).toBeFocused();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  expect(await page.locator('main').evaluate(element => (element as HTMLElement).inert)).toBe(false);
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('skip link and uploader work with the keyboard without nested controls', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Enable the browser's file-picker interception before dispatching keyboard events.
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  expect(new URL(page.url()).hash).toBe('#main-content');
  const dropzone = page.getByRole('button', { name: /Drop files here/ });
  await expect(dropzone.locator('button, input, a')).toHaveCount(0);
  await dropzone.focus();
  await page.keyboard.press('Enter'); await chooser;
});
