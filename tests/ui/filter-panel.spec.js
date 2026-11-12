import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const root = resolve('.test-dist');
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const issues = [];
  errors.set(page, issues);
  page.on('pageerror', error => issues.push(error.message));
  await page.route('http://tagrex.test/**', async route => {
    const path = resolve(root, '.' + new URL(route.request().url()).pathname);
    if (!path.startsWith(root + sep)) return route.abort();
    try {
      await route.fulfill({ body: await readFile(path), contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.woff2') ? 'font/woff2' : 'text/html' });
    } catch { await route.fulfill({ status: 404, body: 'Missing fixture' }); }
  });
  await page.goto('http://tagrex.test/app/ui/index.html');
  await expect.poll(() => page.evaluate(() => typeof window.tagrex?.openLibrary)).toBe('function');
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function library(page) {
  await page.locator('#root-display').click();
  await page.locator('#root').fill('/music');
  await page.locator('#root').press('Enter');
  await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(3);
}

test('filter is a collapsed dock below the scroller and keeps an active summary with Clear', async ({ page }) => {
  await library(page);
  const toggle = page.locator('#filter-panel-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#filter')).toBeHidden();
  expect(await page.evaluate(() => document.getElementById('files-view').nextElementSibling.id)).toBe('filter-panel');
  await expect(page.locator('.view-tabs #filter')).toHaveCount(0);
  await expect(page.locator('#filter-panel #presets-btn')).toHaveCount(1);
  await toggle.click();
  await page.locator('#filter').fill('Wish Mountain');
  await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(1);
  await toggle.click();
  await expect(page.locator('#filter')).toBeHidden();
  await expect(page.locator('#filter-panel-summary')).toHaveText('Wish Mountain');
  await expect(page.locator('#filter-panel')).toHaveClass(/has-filter/);
  await page.locator('#filter-panel-clear').click();
  await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(3);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#filter-panel-summary')).toHaveText('');
  await expect(toggle).toBeFocused();
});

test('filter shortcut reveals the panel and selects its existing query', async ({ page }) => {
  await library(page);
  await page.keyboard.press('Control+f');
  await expect(page.locator('#filter-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#filter')).toBeFocused();
  await page.locator('#filter').fill('Radio');
  await page.locator('#filter-panel-toggle').click();
  await page.keyboard.press('Control+f');
  await expect(page.locator('#filter')).toBeFocused();
  expect(await page.locator('#filter').evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([0, 5]);
});

test('panel preference and existing regex/case preferences persist without destroying native controls', async ({ page }) => {
  await page.locator('#filter-panel-toggle').click();
  await page.locator('#filter-regex').click();
  await page.locator('#filter-case').click();
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.tagrex?.openLibrary)).toBe('function');
  await expect(page.locator('#filter-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#filter-regex')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#filter-case')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#filter-panel-toggle').click();
  await page.reload();
  await expect(page.locator('#filter-panel-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#filter')).toHaveCount(1);
  await expect(page.locator('#presets-menu')).toHaveCount(1);
});

for (const viewport of [{ width: 375, height: 667 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
  test(`filter and upward preset menu remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await library(page);
    await page.locator('#filter-panel-toggle').click();
    await expect(page.locator('#filter')).toBeInViewport({ ratio: 1 });
    const input = await page.locator('#filter').boundingBox();
    expect(input.width).toBeGreaterThanOrEqual(100);
    await page.locator('#presets-btn').click();
    await expect(page.locator('#presets-menu')).toBeInViewport({ ratio: 1 });
    const bounds = await page.locator('#presets-menu').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.locator('#filter-panel-toggle').click();
    await expect(page.locator('#presets-menu')).toBeHidden();
  });
}
