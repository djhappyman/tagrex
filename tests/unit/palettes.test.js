import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_ACCENT, PALETTES, paletteAccent } from '../../app/ui/js/palettes.js';

const css = await readFile(new URL('../../app/ui/palettes.css', import.meta.url), 'utf8');
const surfaces = new Map([...css.matchAll(/^:root\[data-palette="(\w+)"\](\[data-theme="dark"\])? \{([^}]+)\}/gm)]
  .map(([, id, dark, declarations]) => [`${id}:${dark ? 'dark' : 'light'}`, Object.fromEntries([...declarations.matchAll(/--([\w-]+):\s*(#[\da-f]+);/g)].map(([, token, value]) => [token, value]))]));
const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels.reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
let sequence = 0;
async function appearance(seed = {}, dark = true) {
  const savedGlobals = Object.fromEntries(['document', 'localStorage', 'window', 'getComputedStyle'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const values = new Map(Object.entries(seed));
  const styles = new Map();
  const root = { dataset: {}, style: { setProperty: (name, value) => styles.set(name, value), removeProperty: name => styles.delete(name) } };
  const events = [];
  const media = { matches: dark, addEventListener(_name, callback) { this.change = callback; } };
  Object.assign(globalThis, {
    localStorage: { getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, String(value)), removeItem: name => values.delete(name) },
    document: { documentElement: root, dispatchEvent: event => events.push(event.type) },
    window: { matchMedia: () => media },
    getComputedStyle: () => ({ getPropertyValue: name => surfaces.get(`${root.dataset.palette}:${root.dataset.theme}`)?.[name.slice(2)] || '' }),
  });
  const prefs = await import(`../../app/ui/js/prefs.js?palette-test=${sequence++}`);
  return { prefs, root, values, styles, media, events, restore() {
    for (const [name, descriptor] of Object.entries(savedGlobals)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  } };
}

test('all palette modes have readable normal and muted text on every surface', () => {
  assert.equal(surfaces.size, PALETTES.length * 2);
  for (const [name, tokens] of surfaces) {
    for (const text of ['text', 'muted']) for (const surface of ['bg', 'panel', 'row-hover', 'row-stripe']) {
      assert.ok(contrast(tokens[text], tokens[surface]) >= 4.5, `${name}: ${text} on ${surface} = ${contrast(tokens[text], tokens[surface]).toFixed(2)}`);
    }
    assert.ok(contrast(tokens.bg, tokens['row-stripe']) < 1.15, `${name}: stripes must remain quiet`);
  }
});

test('placeholder colours stay quieter than values and readable in every palette', () => {
  for (const [name, tokens] of surfaces) {
    for (const surface of ['bg','panel']) assert.ok(contrast(tokens['field-ghost'],tokens[surface])>=4.5, `${name}: placeholder on ${surface}`);
    assert.ok(contrast(tokens['field-ghost'],tokens.bg)<contrast(tokens.muted,tokens.bg),`${name}: placeholder recedes below helper text`);
  }
  for (const mode of ['dark','light']) {
    const values=PALETTES.map(p=>luminance(surfaces.get(`${p.id}:${mode}`)['field-ghost']));
    assert.ok(Math.max(...values)-Math.min(...values)<.006,'matching placeholder tone across palettes');
  }
});

test('dark palettes retain the approved lifted surfaces and sampled Navy colours', () => {
  // Resolved pixels from the approved 751×733 reference image, rather than
  // inferred navy colours: shell, filled inputs/table, and alternating rows.
  const navy = surfaces.get('navy:dark');
  assert.equal(navy.panel, '#1a1f34');
  assert.equal(navy.bg, '#252a40');
  assert.equal(navy['row-stripe'], '#2b3046');
  for (const palette of PALETTES) {
    const tokens = surfaces.get(`${palette.id}:dark`);
    assert.ok(luminance(tokens.bg) > luminance(tokens.panel), `${palette.id}: controls/table lift above shell`);
    assert.ok(luminance(tokens['row-stripe']) > luminance(tokens.bg), `${palette.id}: stripe is the next quiet tone`);
  }
});

test('all families keep the same surface ratios and text luminances in both modes', () => {
  for (const mode of ['light', 'dark']) {
    const target = surfaces.get(`navy:${mode}`);
    for (const pair of [['panel', 'bg'], ['bg', 'row-stripe'], ['bg', 'row-hover']]) {
      const ratios = PALETTES.map(palette => {
        const tokens = surfaces.get(`${palette.id}:${mode}`);
        return contrast(tokens[pair[0]], tokens[pair[1]]);
      });
      // One 8-bit sRGB channel step accounts for the remaining quantization.
      assert.ok(Math.max(...ratios) - Math.min(...ratios) < .012, `${mode}: ${pair.join('/')} ratio spread`);
    }
    for (const palette of PALETTES) for (const token of ['bg', 'panel', 'row-stripe', 'row-hover', 'border', 'text', 'muted']) {
      const actual = surfaces.get(`${palette.id}:${mode}`);
      assert.ok(Math.abs(luminance(actual[token]) - luminance(target[token])) < .0035, `${palette.id}:${mode}: ${token} luminance`);
    }
  }
});

test('fresh preferences start navy with amber; older implicit green stays green', async () => {
  for (const [seed, accent] of [[{}, DEFAULT_ACCENT], [{ 'tagrex.theme': 'auto' }, null], [{ 'tagrex.theme': 'dark', 'tagrex.accent': '#123abc' }, '#123abc']]) {
    const app = await appearance(seed);
    try {
      assert.equal(app.root.dataset.palette, 'navy');
      assert.equal(app.prefs.accentColor(), accent);
      assert.equal(app.values.get('tagrex.accent') || null, accent);
    } finally { app.restore(); }
  }
});

test('surface choices preserve explicit accents and emit the shared appearance event', async () => {
  const app = await appearance({ 'tagrex.theme': 'dark', 'tagrex.accent': '#123abc' });
  try {
    const count = app.events.length;
    app.prefs.applyPalette('forest');
    assert.equal(app.root.dataset.palette, 'forest');
    assert.equal(app.values.get('tagrex.palette'), 'forest');
    assert.equal(app.prefs.accentColor(), '#123abc');
    assert.equal(app.events.length, count + 1);
    assert.equal(app.events.at(-1), 'tagrex:appearance');
    app.prefs.saveAccent(paletteAccent('forest'));
    assert.equal(app.prefs.accentColor(), paletteAccent('forest'));
    app.prefs.applyPalette('plum');
    assert.equal(app.prefs.accentColor(), paletteAccent('forest'));
    app.prefs.saveAccent(null);
    assert.equal(app.prefs.accentColor(), null);
    assert.equal(app.styles.has('--accent'), false);
  } finally { app.restore(); }
});

test('saved palettes survive reload, invalid values fall back, and Auto keeps following the OS', async () => {
  const app = await appearance({ 'tagrex.palette': 'forest', 'tagrex.theme': 'auto', 'tagrex.accent': '#aabbcc' }, false);
  try {
    assert.equal(app.root.dataset.palette, 'forest');
    assert.equal(app.root.dataset.theme, 'light');
    app.media.matches = true;
    app.media.change();
    assert.equal(app.root.dataset.theme, 'dark');
    assert.equal(app.root.dataset.palette, 'forest');
    app.prefs.applyTheme('light');
    app.media.change();
    assert.equal(app.root.dataset.theme, 'light');
    app.prefs.applyPalette('unknown');
    assert.equal(app.root.dataset.palette, 'navy');
    assert.equal(app.prefs.accentColor(), '#aabbcc');
  } finally { app.restore(); }
});

test('preset and extreme custom accents retain readable ink and button labels on every palette', async () => {
  const app = await appearance({ 'tagrex.theme': 'dark' });
  try {
    for (const palette of PALETTES) for (const mode of ['light', 'dark']) {
      app.prefs.applyTheme(mode);
      app.prefs.applyPalette(palette.id);
      const tokens = surfaces.get(`${palette.id}:${mode}`);
      for (const hex of [palette.accent, ...app.prefs.ACCENT_PRESETS.map(preset => preset.hex).filter(Boolean), '#ffffff', '#000000', '#888888', '#ffff00', '#123abc']) {
        app.prefs.saveAccent(hex);
        assert.ok(contrast(app.styles.get('--accent'), app.styles.get('--accent-text')) >= 4.5, `${palette.id}:${mode} ${hex}: button label`);
        for (const surface of ['bg', 'panel']) assert.ok(contrast(app.styles.get('--accent-ink'), tokens[surface]) >= 4.5, `${palette.id}:${mode} ${hex}: accent ink on ${surface} = ${contrast(app.styles.get('--accent-ink'), tokens[surface]).toFixed(2)}`);
      }
    }
  } finally { app.restore(); }
});
