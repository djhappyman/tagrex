import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const root = resolve('.test-dist');
test.beforeEach(async ({ page }) => {
  await page.route('http://tagrex.test/**', async route => {
    const path = resolve(root, '.' + new URL(route.request().url()).pathname);
    if (!path.startsWith(root + sep)) return route.abort();
    try { await route.fulfill({ body: await readFile(path), contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.woff2') ? 'font/woff2' : 'text/html' }); }
    catch { await route.fulfill({ status: 404, body: 'Missing fixture' }); }
  });
  await page.goto('http://tagrex.test/app/ui/index.html');
  await expect.poll(() => page.evaluate(() => !!window.tagrex)).toBe(true);
});

test('provider dropdown uses themed animated options and preserves native controller values', async ({ page }) => {
  const trigger = page.locator('#online-source-control');
  await trigger.click();
  const menu = page.locator('.app-select-menu');
  await expect(menu).toBeVisible();
  expect(await menu.evaluate(node => getComputedStyle(node).animationName)).toBe('app-select-in');
  await page.getByRole('option', { name: 'MusicBrainz', exact: true }).click();
  await expect(page.locator('#online-source')).toHaveValue('musicbrainz');
  await expect(trigger).toContainText('MusicBrainz');
  await expect(menu).toHaveCount(0);
  await page.evaluate(() => { window.selectEvents = 0; const node = document.querySelector('#online-source'); node.addEventListener('change', () => window.selectEvents++); node.value = 'discogs'; });
  await expect(trigger).toContainText('Discogs');
  expect(await page.evaluate(() => window.selectEvents)).toBe(0);
});

test('Escape closes a settings dropdown before its parent dialog; options fit a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('#settings-open').click();
  await page.locator('#settings-search').fill('Read Latin-1');
  await page.locator('#set-code-page-control').click();
  const menu = page.locator('.app-select-menu');
  await expect(menu).toBeVisible();
  const rect = await menu.boundingBox();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(375);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#settings')).toBeVisible();
  await page.locator('#set-code-page-control').click();
  await page.getByRole('option', { name: 'KOI8-R (Russian)', exact: true }).click();
  await expect(page.locator('#set-code-page')).toHaveValue('koi8-r');
});

test('the source selector keeps its accessible name without a redundant visible label', async ({ page }) => {
  await expect(page.locator('#online-source')).toHaveAttribute('aria-label','Source');
  await page.locator('#online-source-control').click();
  await expect(page.locator('.app-select-menu')).toBeVisible();
  await page.getByRole('option', { name: 'MusicBrainz', exact: true }).click();
  await expect(page.locator('#online-source')).toHaveValue('musicbrainz');
  await expect(page.locator('#online-source-control')).toContainText('MusicBrainz');
  await expect(page.locator('.app-select-menu')).toHaveCount(0);
});

test('changing an open option list closes stale choices and selecting again uses the current option', async ({ page }) => {
  await page.locator('#online-source-control').click();
  await expect(page.getByRole('option', { name: 'MusicBrainz', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.optionChanges = 0;
    const select = document.getElementById('online-source');
    select.addEventListener('change', () => window.optionChanges++);
    select.prepend(new Option('Added provider', 'added'));
  });
  await expect(page.locator('.app-select-menu')).toHaveCount(0);
  expect(await page.evaluate(() => window.optionChanges)).toBe(0);
  await page.locator('#online-source-control').click();
  await page.getByRole('option', { name: 'MusicBrainz', exact: true }).click();
  await expect(page.locator('#online-source')).toHaveValue('musicbrainz');
  expect(await page.evaluate(() => window.optionChanges)).toBe(1);
});

test('hiding a native select closes its menu and restores a usable trigger when shown', async ({ page }) => {
  const trigger = page.locator('#online-source-control');
  await trigger.click();
  await expect(page.locator('.app-select-menu')).toBeVisible();
  await page.evaluate(() => { document.getElementById('online-source').hidden = true; });
  await expect(trigger).toBeHidden();
  await expect(page.locator('.app-select-menu')).toHaveCount(0);
  await page.evaluate(() => { document.getElementById('online-source').hidden = false; });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole('option', { name: 'Bandcamp', exact: true }).click();
  await expect(page.locator('#online-source')).toHaveValue('bandcamp');
});

test('a dynamic settings select follows its field when the window grows and retains explicit widths', async ({ page }) => {
  await page.setViewportSize({ width:375, height:844 });
  await page.locator('#settings-open').click();
  await page.evaluate(() => {
    const row = document.createElement('div');
    row.className = 'settings-row';
    row.id = 'responsive-select-row';
    const label = document.createElement('label');
    label.htmlFor = 'responsive-select';
    label.textContent = 'Responsive choice';
    const select = document.createElement('select');
    select.id = 'responsive-select';
    select.append(new Option('Short', 'short'), new Option('Longer choice', 'long'));
    row.append(label, select);
    document.querySelector('.settings-body').prepend(row);
  });
  const trigger = page.locator('#responsive-select-control');
  await expect(trigger).toBeVisible();
  const small = await trigger.boundingBox();
  await page.setViewportSize({ width:1280, height:844 });
  await expect.poll(async () => (await trigger.boundingBox()).width).toBeGreaterThan(small.width + 60);
  await trigger.click();
  await page.getByRole('option', { name:'Longer choice', exact:true }).click();
  await expect(page.locator('#responsive-select')).toHaveValue('long');
  await page.evaluate(() => {
    const select = document.createElement('select');
    select.id = 'fixed-width-select';
    select.style.width = '140px';
    select.append(new Option('Fixed width', 'fixed'));
    document.getElementById('responsive-select-row').after(select);
  });
  const fixed = page.locator('#fixed-width-select-control');
  await expect(fixed).toBeVisible();
  expect((await fixed.boundingBox()).width).toBeCloseTo(140, 0);
  await page.setViewportSize({ width:844, height:844 });
  expect((await fixed.boundingBox()).width).toBeCloseTo(140, 0);
});
