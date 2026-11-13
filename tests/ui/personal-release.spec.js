import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

test('personal builds keep upstream update controls hidden through settings search', async ({ page }) => {
  const root = resolve('.test-dist');
  await page.route('http://tagrex.test/**', async route => {
    const path = resolve(root, '.' + new URL(route.request().url()).pathname);
    if (!path.startsWith(root + sep)) return route.abort();
    try {
      const contentType = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.woff2') ? 'font/woff2' : 'text/html';
      await route.fulfill({ body: await readFile(path), contentType });
    } catch { await route.fulfill({ status: 404, body: 'Missing fixture' }); }
  });
  await page.goto('http://tagrex.test/app/ui/index.html');
  await expect.poll(() => page.evaluate(() => typeof window.tagrex?.setMode)).toBe('function');
  await page.locator('#settings-open').click();
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('#update-check-now')).toBeHidden();
  await expect(page.locator('#set-check-updates-control')).toBeHidden();
  await page.locator('#settings-search').fill('updates');
  await expect(page.locator('#update-check-now')).toBeHidden();
  await page.locator('#settings-search').fill('');
  await expect(page.locator('#set-check-updates-control')).toBeHidden();
});
