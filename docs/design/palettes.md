# Workbench surface palettes

The four surface families are Navy (default), Graphite, Forest and Plum.
`tagrex.palette` is a local display preference. It stamps `data-palette` on the
root independently of the existing `data-theme` light/dark resolution. Auto
continues to follow the operating system. No backend settings change is needed.

`palettes.css` owns the existing surface tokens: `--panel` is the shell and
editor, `--bg` is the filled table/control surface, `--text`, `--muted`, `--border`
and `--row-hover` retain their meanings. The only added app-wide surface token,
`--row-stripe`, gives alternating rows a quiet tint. Palette preview variables
are scoped to the Settings buttons. Shadows stay neutral. Semantic green/red
and the existing accent fill derivation remain independent of the palettes.
Accent ink is checked against both `--bg` and `--panel` for readable small text.

All appearance controls persist immediately, including when the Settings sheet
is closed with Cancel. Palette help states this behavior. Switching palette
never changes a stored accent. “Use palette accent” explicitly chooses that
family's recommended accent. Custom colors and the brand-green swatch remain
available. General settings Reset deliberately restores Navy, Auto and amber.

Fresh preferences start Navy with warm amber (`#d4a15a`). Earlier versions wrote
`tagrex.theme` at startup; its presence preserves the former implicit green
when no accent was saved. An existing accent always takes precedence. New-user
initialization never rewrites a saved accent.

## Reference surfaces

The approved 751 × 733 reference image resolves to an indigo shell `#1a1f34`,
filled inputs/table `#252a40` and zebra rows `#2b3046`. These are sampled image
pixels: the original `main-interface-refined.html` inherits its host theme
variables rather than defining those resolved colours. Navy now matches those
three values exactly and uses the reference's softer text `#c2cae9`.

Dark controls and the table are lighter than their surrounding shell. Every
dark family follows that same tonal hierarchy; the prior near-black Navy table
and recessed inputs did not match the reference. Both light and dark families
are calibrated to Navy's per-token relative luminance, retaining their own hues
and saturation. Navy's light values remain the light-mode target. The remaining
small ratio differences come from rounding to 8-bit sRGB channels. Graphite
stays close to neutral; Forest and Plum retain their restrained green/purple
character. Settings swatches preview the actual shell and filled tones.
Custom accents and semantic success/error colours remain unchanged.

| Dark family | Shell | Filled table/control | Stripe | Hover | Border |
| --- | --- | --- | --- | --- | --- |
| Navy | `#1a1f34` | `#252a40` | `#2b3046` | `#343951` | `#3d435b` |
| Graphite | `#1f2024` | `#2a2b31` | `#303137` | `#393a42` | `#43444b` |
| Forest | `#1a2220` | `#242d29` | `#29332f` | `#313d37` | `#39473e` |
| Plum | `#251d29` | `#2f2836` | `#362e3c` | `#3f3747` | `#4d3f55` |

Measured surface contrast ratios:

| Family | Mode | Shell ↔ filled | Filled ↔ stripe | Filled ↔ hover |
| --- | --- | --- | --- | --- |
| Navy | Light | 1.0972:1 | 1.0471:1 | 1.1929:1 |
| Navy | Dark | 1.1507:1 | 1.0876:1 | 1.2468:1 |
| Graphite | Light | 1.1009:1 | 1.0531:1 | 1.1965:1 |
| Graphite | Dark | 1.1535:1 | 1.0886:1 | 1.2483:1 |
| Forest | Light | 1.0918:1 | 1.0425:1 | 1.1875:1 |
| Forest | Dark | 1.1459:1 | 1.0853:1 | 1.2502:1 |
| Plum | Light | 1.0954:1 | 1.0485:1 | 1.1894:1 |
| Plum | Dark | 1.1486:1 | 1.0915:1 | 1.2512:1 |

Across families, the maximum ratio spreads (shell/filled, filled/stripe,
filled/hover) are light: 0.0091, 0.0106, 0.0090;
dark: 0.0075, 0.0062, 0.0044.
The largest spread is 0.0106:1; every corresponding token’s relative
luminance differs from Navy by less than 0.0032.

## Verification

`node --test tests/unit/palettes.test.js tests/unit/catalogue.test.js` checks
sampled reference colours, lifted dark surfaces, matched luminance/contrast
ratios across all families in both modes, initialization/migration,
persistence, Auto and forced modes, appearance events,
explicit recommendations, reset-to-brand behavior, all locale key sets, every
accent preset, and extreme custom colors across all eight palette/mode pairs.
The Settings component also passed the official Svelte 5.57.3 autofixer.

Computed WCAG sRGB contrast from the source tokens, taking the minimum across
inset, shell, hover and striped surfaces:

| Family | Mode | Text | Muted text | Stripe against inset |
| --- | --- | --- | --- | --- |
| Navy | Light | 11.92:1 | 5.30:1 | 1.05:1 |
| Navy | Dark | 6.98:1 | 5.67:1 | 1.09:1 |
| Graphite | Light | 11.97:1 | 5.27:1 | 1.05:1 |
| Graphite | Dark | 6.97:1 | 5.64:1 | 1.09:1 |
| Forest | Light | 11.90:1 | 5.32:1 | 1.04:1 |
| Forest | Dark | 6.98:1 | 5.68:1 | 1.09:1 |
| Plum | Light | 11.99:1 | 5.31:1 | 1.05:1 |
| Plum | Dark | 7.00:1 | 5.67:1 | 1.09:1 |

`tests/ui/palettes.spec.js` covers live Cancel/Save/reload behavior, the explicit
accent action, keyboard activation/focus and narrow containment in both modes.
Run it after rebuilding the existing UI fixtures. These mock-app checks do not
claim native rendering or cross-platform validation. Use the full workbench
suite and a native visual pass to verify the combined interface change.

This is shared interface behavior eligible for the curated upstream `next`
route. Integration, commits and publication are owned by the workbench task.
