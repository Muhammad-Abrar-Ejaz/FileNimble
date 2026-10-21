import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const malformedPdf = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\nsynthetic malformed fixture\n%%EOF'),
});

async function pdfFile(name: string) {
  const document = await PDFDocument.create();
  document.addPage([200, 240]);
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await document.save()) };
}

function contrastRatio(foreground: string, background: string) {
  const channels = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  const luminance = (color: string) => {
    const values = channels(color);
    if (!values || values.length !== 3) throw new Error(`Unexpected computed color: ${color}`);
    const [red, green, blue] = values.map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('PDF merge selection exposes a readable, correctly enabled page-inspection action', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/merge-pdf');
  const input = page.getByLabel('Upload files');

  await input.setInputFiles(await pdfFile('single.pdf'));
  const action = page.getByRole('button', { name: 'Read PDF pages' });
  await expect(action).toBeVisible();
  await expect(action).toBeDisabled();
  await expect(page.getByText('single.pdf')).toBeVisible();

  await page.getByRole('button', { name: 'Clear all' }).click();
  await input.setInputFiles([await pdfFile('first.pdf'), await pdfFile('second.pdf')]);
  await expect(action).toBeVisible();
  await expect(action).toBeEnabled();
  await expect(page.getByText('first.pdf')).toBeVisible();
  await expect(page.getByText('second.pdf')).toBeVisible();

  const styles = await action.evaluate(element => {
    const computed = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      width: box.width,
      height: box.height,
      right: box.right,
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(contrastRatio(styles.color, styles.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  expect(styles.right).toBeLessThanOrEqual(styles.viewportWidth);
  expect(styles.documentWidth).toBeLessThanOrEqual(styles.viewportWidth);

  await page.screenshot({ path: 'test-results/pdf-merge-mobile-selection.png', fullPage: false });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(action).toBeVisible();
  const desktop = await action.boundingBox();
  expect(desktop).not.toBeNull();
  expect(desktop!.x + desktop!.width).toBeLessThanOrEqual(1280);
  await page.screenshot({ path: 'test-results/pdf-merge-desktop-selection.png', fullPage: false });

  await action.click();
  await expect(page.getByRole('status')).toContainText('Validating files...');
  await expect(page.getByRole('group', { name: 'PDF options' })).toBeVisible();
  await expect(page.getByText('first.pdf: 1 pages • second.pdf: 1 pages')).toBeVisible();
  await page.getByRole('button', { name: 'Create PDF results' }).click();
  await expect(page.getByRole('region', { name: 'Conversion completed' })).toBeVisible();

  await page.getByRole('button', { name: 'Convert Another' }).click();
  await page.getByLabel('Upload files').setInputFiles([malformedPdf('broken-first.pdf'), malformedPdf('broken-second.pdf')]);
  await page.getByRole('button', { name: 'Read PDF pages' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Conversion Failed' })).toContainText('malformed page tree');
});
