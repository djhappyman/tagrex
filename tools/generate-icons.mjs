// Regenerate the desktop icon set without retaining unused mobile outputs.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'tagnetic-icons-'));
const names = ['icon.icns', 'icon.ico', 'icon.png', '32x32.png', '64x64.png',
  '128x128.png', '128x128@2x.png', 'StoreLogo.png', ...[30, 44, 71, 89, 107, 142, 150, 284, 310].map(size => `Square${size}x${size}Logo.png`)];
try {
  execFileSync(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
    'icon', join(root, 'app/ui/assets/tagnetic-icon.svg'), '--output', temporary], { stdio: 'inherit' });
  mkdirSync(join(root, 'app/icons'), { recursive: true });
  for (const name of names) copyFileSync(join(temporary, name), join(root, 'app/icons', name));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
