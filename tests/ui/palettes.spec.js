import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

// Use the same isolated mock app as the existing workspace tests; no media or
// native runtime state is touched by these appearance-only checks.
const root = resolve('.test-dist');
test.beforeEach(async ({ page }) => {
  await page.route('http://tagrex.test/**', async route => {
    const path = resolve(root, '.' + new URL(route.request().url()).pathname);
    if (!path.startsWith(root + sep)) return route.abort();
    try {
      await route.fulfill({ body: await readFile(path), contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.woff2') ? 'font/woff2' : 'text/html' });
    } catch { await route.fulfill({ status: 404, body: 'Missing fixture' }); }
  });
});
async function open(page) {
  await page.goto('http://tagrex.test/app/ui/index.html');
  await expect.poll(() => page.evaluate(() => typeof window.tagrex?.setMode)).toBe('function');
}
async function settings(page) {
  await page.locator('#settings-open').click();
  await page.locator('#settings-nav-list button').first().click();
}
const choice = (page, id) => page.locator(`#set-palette [data-palette-choice="${id}"]`);

test('palettes persist live through Cancel, Save and reload without replacing a chosen accent', async ({ page }) => {
  await open(page);
  await settings(page);
  await page.locator('.accent-swatch[data-accent="#2563eb"]').click();
  await choice(page, 'forest').click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
  await expect(choice(page, 'forest')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('tagrex.accent'))).toBe('#2563eb');
  await page.locator('#settings-cancel').click();
  await settings(page);
  await expect(choice(page, 'forest')).toHaveAttribute('aria-pressed', 'true');
  await choice(page, 'plum').click();
  await page.locator('#settings-save').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
  expect(await page.evaluate(() => localStorage.getItem('tagrex.accent'))).toBe('#2563eb');
  await settings(page);
  await expect(choice(page, 'plum')).toHaveAttribute('aria-pressed', 'true');
});

test('fresh amber is retained until the recommended palette accent is explicitly chosen', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => localStorage.getItem('tagrex.accent'))).toBe('#d4a15a');
  await settings(page);
  await choice(page, 'forest').click();
  expect(await page.evaluate(() => localStorage.getItem('tagrex.accent'))).toBe('#d4a15a');
  await page.locator('#set-palette-accent').click();
  expect(await page.evaluate(() => localStorage.getItem('tagrex.accent'))).toBe('#bba36b');
  await choice(page, 'navy').click();
  expect(await page.evaluate(() => localStorage.getItem('tagrex.accent'))).toBe('#bba36b');
});

for (const theme of ['light', 'dark']) test(`palette choices are labelled and keyboard reachable at narrow width in ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 850 });
  await open(page);
  await settings(page);
  await page.locator(`#set-theme [data-theme-mode="${theme}"]`).click();
  for (const id of ['navy', 'graphite', 'forest', 'plum']) {
    const button = choice(page, id);
    await button.focus();
    await expect(button).toBeFocused();
    await expect(button).toHaveAccessibleName(/\S/);
    await button.press('Space');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#set-palette [aria-pressed="true"]')).toHaveCount(1);
    const field = await page.locator('#set-palette').boundingBox();
    const bounds = await button.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(field.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(field.x + field.width + 1);
    expect(await button.evaluate(node => {
      const style = getComputedStyle(node);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    })).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-palette', id);
  }
  await expect(page.locator('#settings-save')).toBeInViewport();
});
