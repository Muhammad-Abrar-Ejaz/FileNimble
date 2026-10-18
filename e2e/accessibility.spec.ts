import { expect, test } from '@playwright/test';

function contrastRatio(foreground: string, background: string) {
  const channels = (color: string) => {
    const match = color.match(/rgba?\(([^)]+)\)/i);
    const values = match
      ? match[1].replaceAll('/', ',').split(/[\s,]+/).filter(Boolean).slice(0, 3).map(Number)
      : color.match(/^#([\da-f]{6})$/i)?.[1].match(/../g)?.map(value => parseInt(value, 16));
    if (!values || values.length < 3 || values.some(value => !Number.isFinite(value))) {
      throw new Error(`Unsupported computed color format: ${color}`);
    }
    return values.map(value => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
  };
  const luminance = (color: string) => {
    const [red, green, blue] = channels(color);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('homepage contrast and heading hierarchy meet accessible thresholds', async ({ page }) => {
  await page.goto('/');
  const structure = await page.evaluate(() => {
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(heading => Number(heading.tagName.slice(1)));
    const root = getComputedStyle(document.documentElement);
    const searchLink = document.querySelector('header a[aria-label="Search all tools"]');
    const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="Search conversion tools"]');
    const heroDescription = document.querySelector<HTMLElement>('main > div > section p.text-text-muted');
    const toolDescription = document.querySelector<HTMLElement>('main article p.text-text-muted');
    const uploaderTitle = document.querySelector('[role="button"] h2');
    const renderedColor = (element: Element | null, pseudo?: string) => element ? getComputedStyle(element, pseudo).color : null;
    return {
      headings,
      muted: root.getPropertyValue('--color-text-muted').trim(),
      appBackground: root.getPropertyValue('--color-background-app').trim(),
      surface: root.getPropertyValue('--color-surface').trim(),
      headerSearch: renderedColor(searchLink),
      placeholder: renderedColor(searchInput, '::placeholder'),
      heroDescription: renderedColor(heroDescription),
      toolDescription: renderedColor(toolDescription),
      toolCardOpacity: toolDescription ? getComputedStyle(toolDescription.closest('article')!).opacity : null,
      uploaderTitleIsLevelTwo: Boolean(uploaderTitle),
    };
  });

  expect(structure.uploaderTitleIsLevelTwo).toBe(true);
  for (let index = 1; index < structure.headings.length; index += 1) {
    expect(structure.headings[index], `heading ${index + 1} skips a level`).toBeLessThanOrEqual(structure.headings[index - 1] + 1);
  }
  expect(structure.headerSearch).toBeTruthy();
  expect(structure.placeholder).toBeTruthy();
  expect(structure.heroDescription).toBeTruthy();
  expect(structure.toolDescription).toBeTruthy();
  expect(structure.toolCardOpacity).toBe('1');
  for (const color of [structure.muted, structure.headerSearch, structure.placeholder, structure.heroDescription, structure.toolDescription]) {
    expect(contrastRatio(color!, '#ffffff'), `${color} on white`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color!, structure.appBackground), `${color} on app background`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color!, '#f3f4f6'), `${color} on filter/header tint`).toBeGreaterThanOrEqual(4.5);
  }
});

test('primary routes expose named controls and reflow at mobile, tablet, and desktop widths', async ({ page }) => {
  for (const route of ['/', '/tools', '/tar-to-zip', '/zip-to-tar', '/privacy', '/terms', '/contact']) {
    await page.goto(route);
    await expect(page.locator('main h1')).toHaveCount(1);
    const unnamedControls = await page.evaluate(() => {
      const controls = [...document.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[role="button"],[role="dialog"]')]
        .filter(element => !element.matches('input[type="hidden"]'));
      return controls.filter(element => {
        const labelledBy = element.getAttribute('aria-labelledby')?.split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
        const labels = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
          ? [...(element.labels ?? [])].map(label => label.textContent?.trim()).filter(Boolean).join(' ')
          : '';
        const imageAlt = [...element.querySelectorAll('img[alt]')].map(image => image.getAttribute('alt')).filter(Boolean).join(' ');
        const name = element.getAttribute('aria-label') || labelledBy || labels || element.innerText?.trim() || imageAlt || element.getAttribute('title');
        return !name;
      }).map(element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`);
    });
    expect(unnamedControls, `${route} has unnamed interactive controls`).toEqual([]);

    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: `${route} overflows at ${width}px` }).toBe(true);
    }
  }
});

test('keyboard focus, search controls, and mobile navigation remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  const skipFocus = await skipLink.evaluate(element => ({ outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }));
  expect(skipFocus.outline).not.toBe('none');
  expect(skipFocus.width).not.toBe('0px');

  const search = page.getByRole('searchbox', { name: 'Search conversion tools' });
  await expect(search).toBeVisible();
  await search.fill('not-a-real-file-tool');
  await expect(page.getByRole('button', { name: 'Clear search input' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All Categories', exact: false })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'No tools found' })).toBeVisible();

  const opener = page.getByRole('button', { name: 'Open mobile navigation menu' });
  await opener.click();
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  const dialog = page.getByRole('dialog', { name: 'Mobile Navigation Menu' });
  await expect(dialog).toHaveAttribute('id', 'mobile-navigation-dialog');
  await expect(opener).toHaveAttribute('aria-controls', 'mobile-navigation-dialog');
  const close = dialog.getByRole('button', { name: 'Close navigation menu' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
});
