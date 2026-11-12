<script lang="ts">
  import NativeCheckbox from './controls/NativeCheckbox.svelte';
  import NativeSlider from './controls/NativeSlider.svelte';
  import NativeColor from './controls/NativeColor.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select/index.js';
</script>

    <div id="settings" class="settings-overlay" hidden>
      <div id="settings-scrim" class="settings-scrim"></div>
      <div class="settings-sheet" role="dialog" aria-modal="true" data-i18n-aria-label="topbar.settings" aria-label="Settings">
        <div class="settings-head">
          <span class="settings-title" data-i18n="topbar.settings">Settings</span>
          <div class="spacer"></div>
          <Button variant="ghost" size="icon-sm" id="settings-close" class="icon" data-i18n-title="action.close" title="Close" data-i18n-aria-label="action.close" aria-label="Close"><svg class="ico"><use href="#i-close"/></svg></Button>
        </div>
        <div class="settings-main">
        <nav class="settings-nav" data-i18n-aria-label="settings.groups" aria-label="Settings groups">
          <div class="settings-search">
          <Input id="settings-search" type="search" data-i18n-placeholder="settings.search" placeholder="Search settings…" data-i18n-aria-label="settings.search" aria-label="Search settings" spellcheck="false" autocomplete="off"  />
          </div>
          <div id="settings-nav-list" class="settings-nav-list" role="tablist" aria-orientation="vertical"></div>
        </nav>
        <div class="settings-body">
          <p id="settings-search-empty" class="settings-hint" data-i18n="settings.searchEmpty" hidden>No settings match.</p>
          <div class="settings-group" data-icon="i-sliders" data-reset-group="general">
            <h3 data-i18n="settings.general">General</h3>
            <div class="settings-row">
              <label for="set-lang" data-i18n="settings.language">Language</label>
              <NativeSelect id="set-lang" data-i18n-aria-label="settings.language.aria" aria-label="Interface language">
                <NativeSelectOption value="auto" data-i18n="settings.language.auto">Auto</NativeSelectOption>
                <NativeSelectOption value="en" data-i18n="settings.language.en">English</NativeSelectOption>
                <NativeSelectOption value="de" data-i18n="settings.language.de">Deutsch</NativeSelectOption>
                <NativeSelectOption value="es" data-i18n="settings.language.es">Español</NativeSelectOption>
                <NativeSelectOption value="fr" data-i18n="settings.language.fr">Français</NativeSelectOption>
                <NativeSelectOption value="it" data-i18n="settings.language.it">Italiano</NativeSelectOption>
                <NativeSelectOption value="uk" data-i18n="settings.language.uk">Українська</NativeSelectOption>
                <NativeSelectOption value="ru" data-i18n="settings.language.ru">Русский</NativeSelectOption>
              </NativeSelect>
            </div>
            <p class="settings-hint" data-i18n="settings.language.hint">Auto follows your system language. A language the app has no catalogue for falls back to English.</p>
            <div class="settings-row">
              <span class="settings-label" data-i18n="settings.theme">Theme</span>
              <div class="seg" id="set-theme" role="tablist" data-i18n-aria-label="settings.theme" aria-label="Theme">
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-theme-mode="auto" data-i18n="settings.language.auto">Auto</Button>
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-theme-mode="light" data-i18n="settings.theme.light">Light</Button>
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-theme-mode="dark" data-i18n="settings.theme.dark">Dark</Button>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.themeHint">Auto follows your system appearance. Light and Dark override it.</p>
            <div class="settings-row col">
              <span class="settings-label" data-i18n="settings.accent">Accent colour</span>
              <div class="accent-picker" id="set-accent" role="radiogroup" data-i18n-aria-label="settings.accent" aria-label="Accent colour">
                <label class="accent-custom" data-i18n-title="settings.accent.custom" title="Custom colour">
                  <NativeColor id="set-accent-custom" value="#0b6b53" data-i18n-aria-label="settings.accent.custom" aria-label="Custom colour" />
                </label>
                <Button variant="ghost" size="sm" class="accent-reset" id="set-accent-reset" type="button" data-i18n="settings.accent.reset">Reset</Button>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.accentHint">Colours buttons, selections, links and the focus ring. Text on the accent stays readable. Confirmation green and error red do not change.</p>
            <div class="settings-row">
              <label for="set-checkbox-col" data-i18n="settings.checkboxCol">Selection checkbox column</label>
              <NativeCheckbox id="set-checkbox-col" toggle />
            </div>
            <p class="settings-hint" data-i18n="settings.checkboxColHint">Shows a checkbox column in the file table. Off by default. Click a row to select, or Cmd/Shift-click for a range or to toggle.</p>
            <div class="settings-row">
              <label for="set-check-updates" data-i18n="settings.checkUpdates">Check for updates</label>
              <div class="settings-inline">
                <NativeCheckbox id="set-check-updates" toggle />
                <Button variant="ghost" size="sm" id="update-check-now" class="text-btn" type="button" data-i18n="settings.checkNow">Check</Button>
              </div>
            </div>
            <div id="update-row" class="settings-row update-row" hidden>
              <span></span>
              <span id="update-result" class="settings-hint" role="status"></span>
            </div>
            <p class="settings-hint" data-i18n="settings.checkUpdatesHint">At startup, TagRex checks GitHub for the latest release and shows a note in the top bar if a newer one exists. It does not download or install anything, and sends nothing about you or your files. When off, TagRex makes no request.</p>
          </div>

          <div class="settings-group" data-icon="i-db">
            <h3 data-i18n="settings.sources">Sources</h3>
            <h4 class="settings-sub">Discogs</h4>
            <div class="settings-row">
              <label for="discogs-token" data-i18n="settings.discogs.token">Personal token</label>
              <Input id="discogs-token" type="password" class="mono" data-i18n-placeholder="settings.discogs.tokenPlaceholder" placeholder="Personal Discogs token" spellcheck="false" autocomplete="off"  />
            </div>
            <p class="settings-hint" data-i18n="settings.discogs.hint">Used for search, release lookups, and cover fetches.</p>
            <h4 class="settings-sub">Beatport</h4>
            <div class="settings-row">
              <span class="settings-label" data-i18n="settings.beatport.account">Account</span>
              <div class="bp-auth">
                <span id="beatport-account" class="settings-hint" data-i18n="settings.beatport.notSignedIn">Not signed in</span>
                <Button variant="outline" size="sm" id="beatport-signin" class="btn" data-i18n="settings.beatport.signIn">Sign in…</Button>
                <Button variant="outline" size="sm" id="beatport-signout" class="btn" hidden data-i18n="settings.beatport.signOut">Sign out</Button>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.beatport.hint">
              Signs in to your own Beatport account in a separate window. TagRex never sees your
              password. Beatport gives API access to partners only, so this uses the public client
              from its documentation page. That access is unofficial and may stop working without
              notice.
            </p>
          </div>

          <div class="settings-group" data-icon="i-wifi" data-reset-group="network">
            <h3 data-i18n="settings.network">Network</h3>
            <div class="settings-row">
              <label for="set-proxy" data-i18n="settings.proxy">Proxy</label>
              <Input id="set-proxy" type="text" class="mono" data-i18n-placeholder="settings.proxyPlaceholder" placeholder="http://host:port  (blank = none)" spellcheck="false"  />
            </div>
            <div class="settings-row">
              <label for="set-rate" data-i18n="settings.rateLimit">Rate limit</label>
              <div class="settings-inline">
                <Input id="set-rate" type="number" min="0" class="mono" style="width: 64px"  />
                <span class="settings-hint" data-i18n="settings.rateHint">Requests per minute. 0 means no limit. The app still honours server rate limits.</span>
              </div>
            </div>
          </div>

          <div class="settings-group" data-icon="i-tag" data-reset-group="tags">
            <h3 data-i18n="settings.tagsAndCovers">Tags and covers</h3>
            <div class="settings-row">
              <span class="settings-label" data-i18n="settings.id3Version">ID3 version</span>
              <div class="seg" id="set-id3" role="tablist" data-i18n-aria-label="settings.id3Version" aria-label="ID3 version">
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-id3="v23">ID3v2.3</Button>
                <Button variant="ghost" size="sm" class="seg-btn active" type="button" data-id3="v24">ID3v2.4</Button>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.id3Hint">Which ID3v2 revision to write for MP3/AIFF/WAV. v2.4 is the modern default.</p>

            <div class="settings-row col">
              <div class="row-head">
                <span class="settings-label" data-i18n="settings.readPriority">Read priority</span>
                <Button variant="ghost" size="sm" id="set-prio-reset" class="text-btn" type="button" data-i18n-title="settings.resetTitle" title="Restore the default read order: ID3v2, Vorbis, APE" data-i18n="settings.reset">Reset</Button>
              </div>
              <ol id="set-prio" class="prio-list" data-i18n-aria-label="settings.priorityAria" aria-label="Tag-block read priority"></ol>
            </div>
            <p class="settings-hint" data-i18n="settings.priorityHint">If a file has more than one tag block, values come from the highest one in this list. Drag to reorder. Most files have only one block, so this rarely matters.</p>

            <div class="settings-row">
              <label for="set-multi-sep" data-i18n="settings.multiSep">Multi-value separator</label>
              <Input id="set-multi-sep" type="text" class="mono" style="width: 80px" placeholder="; " spellcheck="false"  />
            </div>
            <p class="settings-hint" data-i18n="settings.multiSepHint">Artist, Album Artist, Genre and Composer can hold several values. They are shown and edited as one value joined by this text, then written back as separate values. Other fields keep the separator as part of the value. Leave blank to use a semicolon and a space.</p>
            <div class="settings-row">
              <label for="set-code-page" data-i18n="settings.codePage">Read Latin-1 text as</label>
              <NativeSelect id="set-code-page">
                <NativeSelectOption value="" data-i18n="settings.codePage.latin1">Latin-1 (the standard)</NativeSelectOption>
                <NativeSelectOption value="windows-1251" data-i18n="settings.codePage.cyrillic">Windows-1251 (Cyrillic)</NativeSelectOption>
                <NativeSelectOption value="koi8-r" data-i18n="settings.codePage.russian">KOI8-R (Russian)</NativeSelectOption>
                <NativeSelectOption value="koi8-u" data-i18n="settings.codePage.ukrainian">KOI8-U (Ukrainian)</NativeSelectOption>
                <NativeSelectOption value="windows-1252" data-i18n="settings.codePage.western">Windows-1252 (Western European)</NativeSelectOption>
                <NativeSelectOption value="windows-1250" data-i18n="settings.codePage.central">Windows-1250 (Central European)</NativeSelectOption>
                <NativeSelectOption value="windows-1253" data-i18n="settings.codePage.greek">Windows-1253 (Greek)</NativeSelectOption>
                <NativeSelectOption value="windows-1254" data-i18n="settings.codePage.turkish">Windows-1254 (Turkish)</NativeSelectOption>
                <NativeSelectOption value="windows-1257" data-i18n="settings.codePage.baltic">Windows-1257 (Baltic)</NativeSelectOption>
                <NativeSelectOption value="shift_jis" data-i18n="settings.codePage.japanese">Shift_JIS (Japanese)</NativeSelectOption>
                <NativeSelectOption value="gbk" data-i18n="settings.codePage.simplified">GBK (Simplified Chinese)</NativeSelectOption>
                <NativeSelectOption value="big5" data-i18n="settings.codePage.traditional">Big5 (Traditional Chinese)</NativeSelectOption>
                <NativeSelectOption value="euc-kr" data-i18n="settings.codePage.korean">EUC-KR (Korean)</NativeSelectOption>
              </NativeSelect>
            </div>
            <p class="settings-hint" data-i18n="settings.codePageHint">Older files often store text in a local code page but label it Latin-1, so Кино appears as Êèíî. Choose the code page they were written in. This applies to ID3v1 tags and ID3v2 frames marked Latin-1. Real Latin-1 text will read wrongly under another code page. Text you do not edit keeps its bytes; edited text is written in Unicode.</p>
            <h4 class="settings-sub" data-i18n="editor.coverArt">Cover art</h4>
            <div class="settings-row">
              <label for="set-cover-max" data-i18n="settings.coverMax">Maximum size</label>
              <div class="settings-inline">
                <Input id="set-cover-max" type="number" min="0" step="50" class="mono" style="width: 80px"  />
                <span class="settings-hint" data-i18n="settings.coverMaxHint">Pixels on the longest side. 0 means no resize.</span>
              </div>
            </div>
            <div class="settings-row">
              <label for="set-cover-quality" data-i18n="settings.coverQuality">JPEG quality</label>
              <div class="settings-inline">
                <Input id="set-cover-quality" type="number" min="1" max="100" class="mono" style="width: 64px"  />
                <span class="settings-hint" data-i18n="settings.coverQualityHint">1 to 100. Used when a cover is resized.</span>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.coverHint">Larger covers are scaled down and saved as JPEG before embedding, so they do not bloat every file.</p>
            <h4 class="settings-sub" data-i18n="settings.bpmDetection">BPM detection</h4>
            <div class="settings-row">
              <label for="set-bpm-detection" data-i18n="settings.bpmDetectionToggle">Detect BPM</label>
              <NativeCheckbox id="set-bpm-detection" checked toggle />
            </div>
            <p class="settings-hint" data-i18n="settings.bpmDetectionHint">Shows the metronome in the table toolbar. It measures tempo from the audio of the selected files. When off, the button and its shortcut are disabled.</p>
            <div class="settings-row">
              <label for="set-bpm-max" data-i18n="settings.bpmMax">Skip files longer than</label>
              <div class="settings-inline">
                <Input id="set-bpm-max" type="number" min="0" step="1" class="mono" style="width: 64px"  />
                <span class="settings-hint" data-i18n="settings.bpmMaxHint">Minutes. 0 means no limit.</span>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.bpmMaxLongHint">A DJ mix has no single tempo, and measuring one takes as long as dozens of tracks.</p>
            <div class="settings-row">
              <label for="set-bpm-range" data-i18n="settings.bpmRange">Detected BPM range</label>
              <NativeSelect id="set-bpm-range">
                <NativeSelectOption value="0" data-i18n="settings.bpmRange.asMeasured">As measured</NativeSelectOption>
                <NativeSelectOption value="60">60-120</NativeSelectOption>
                <NativeSelectOption value="70">70-140</NativeSelectOption>
                <NativeSelectOption value="80">80-160</NativeSelectOption>
                <NativeSelectOption value="90">90-180</NativeSelectOption>
              </NativeSelect>
            </div>
            <p class="settings-hint" data-i18n="settings.bpmRangeHint">Detected tempo is halved or doubled to fall inside this range. For example, a track at 174 BPM may be stored as 87; with 70-140 selected, the detected value matches it.</p>

          </div>

          <div class="settings-group" data-icon="i-import" data-reset-group="import">
            <h3 data-i18n="settings.onlineImport">Online import</h3>
            <p class="settings-hint" data-i18n="settings.importHint">Choose which tags an online import may write. All are on by default. A field switched off here keeps the value already in the file.</p>
            <div id="set-import-fields" class="import-fields"></div>
            <div class="settings-inline import-fields-actions">
              <Button variant="ghost" size="sm" id="set-import-all" type="button" class="text-btn" data-i18n="settings.all">All</Button>
              <Button variant="ghost" size="sm" id="set-import-none" type="button" class="text-btn" data-i18n="settings.none">None</Button>
            </div>

            <div class="settings-row">
              <span class="settings-label" data-i18n="editor.coverArt">Cover art</span>
              <div class="seg" id="set-import-cover" role="tablist" data-i18n-aria-label="settings.importCover" aria-label="Import cover art">
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-import-cover="never" data-i18n="settings.cover.never">Never</Button>
                <Button variant="ghost" size="sm" class="seg-btn active" type="button" data-import-cover="if-missing" data-i18n="settings.cover.ifMissing">If missing</Button>
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-import-cover="always" data-i18n="settings.cover.always">Always</Button>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.importCoverHint" data-i18n-html>Also embeds the release cover during import. <strong>If missing</strong> fills only files with no artwork, so nothing you chose is overwritten. <strong>Always</strong> replaces the existing cover. Tags and artwork are one change, so a single undo reverts both.</p>

            <div class="settings-row">
              <span class="settings-label" data-i18n="importField.track">Track number</span>
              <div class="seg" id="set-import-track" role="tablist" data-i18n-aria-label="settings.importTrack" aria-label="Import track number">
                <Button variant="ghost" size="sm" class="seg-btn active" type="button" data-import-track="number" data-i18n="settings.importTrack.number">Number</Button>
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-import-track="position" data-i18n="settings.importTrack.position">Vinyl position</Button>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.importTrackHint" data-i18n-html>Controls how an import writes a vinyl position such as A1. <strong>Number</strong> writes the standard numeric track number (1); the original position goes to POSITION. <strong>Vinyl position</strong> keeps A1 as the track number. MP4 files always get the number. With Vinyl side → disc on, tracks are numbered per side either way.</p>
          </div>

          <div class="settings-group" data-icon="i-doc" data-reset-group="files">
            <h3 data-i18n="settings.files">Files</h3>
            <div class="settings-row col">
              <label for="set-sidecar-exts" data-i18n="settings.extensions">Same-named file extensions</label>
              <Input id="set-sidecar-exts" type="text" class="mono" data-i18n-placeholder="settings.extensionsPlaceholder" placeholder="lrc cue txt jpg jpeg png" spellcheck="false"  />
            </div>
            <p class="settings-hint" data-i18n="settings.extensionsHint">Files with these extensions travel with a renamed or moved track. Separate them with spaces or commas, without the dot; case does not matter. The RENAMER panel has the switch that turns this on.</p>
            <div class="settings-row">
              <label for="set-portable-names" data-i18n="settings.portableNames">Safe file names</label>
              <NativeCheckbox id="set-portable-names" checked toggle />
            </div>
            <p class="settings-hint" data-i18n="settings.portableNamesHint">New file names also work on Windows, USB sticks and SD cards: ":" becomes " -", "?" and "*" are removed, " &lt; &gt; | become _, and a trailing dot or space is dropped. When off, these characters are kept where this system allows them. On Windows they are always replaced.</p>
          </div>

          <div class="settings-group" data-icon="i-command">
            <h3 data-i18n="shortcuts.heading">Shortcuts</h3>
            <div id="set-shortcuts" class="shortcut-list"></div>
            <p id="set-shortcuts-msg" class="settings-hint shortcut-msg" role="status" hidden></p>
            <div class="settings-inline">
              <Button variant="ghost" size="sm" id="set-shortcuts-reset" class="text-btn" type="button" data-i18n="shortcuts.resetAll">Reset</Button>
            </div>
            <p class="settings-hint" data-i18n="shortcuts.hint">Click a shortcut, then press the new keys. Esc cancels. Changes apply at once.</p>
          </div>

          <div class="settings-group" data-icon="i-flask" data-reset-group="lab">
            <h3><span data-i18n="settings.lab">Lab</span> <span class="lab-tag" data-i18n="settings.experimental">experimental</span></h3>
            <p class="settings-hint settings-lab-note" data-i18n="settings.labNote">Typography still under evaluation. These may change or be dropped in a later release.</p>
            <div class="settings-row">
              <label for="set-media-glyphs" data-i18n="settings.mediaGlyphs">Media glyphs</label>
              <NativeSelect id="set-media-glyphs"></NativeSelect>
            </div>
            <p class="settings-hint" data-i18n="settings.mediaGlyphsHint">Chooses the icon family for media badges on Online release cards. Switch to compare live.</p>
            <div class="settings-row">
              <span class="settings-label" data-i18n="settings.valueFont">Value font</span>
              <div class="seg" id="set-value-font" role="tablist" data-i18n-aria-label="settings.valueFont" aria-label="Value font">
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-value-font="mono" data-i18n="settings.font.mono">Mono</Button>
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-value-font="sans" data-i18n="settings.font.sans">Sans</Button>
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-value-font="condensed" data-i18n="settings.font.condensed">Condensed</Button>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.valueFontHint">The font used for file names, tag values, tracklists and pattern fields. Mono keeps columns aligned and makes 0 and O distinct. Sans matches the rest of the interface. Condensed fits more text before truncating.</p>
            <div class="settings-row">
              <label for="set-table-font" data-i18n="settings.tableFont">Table font size</label>
              <div class="settings-inline">
                <NativeSlider id="set-table-font" min="10" max="20" step="1" />
                <span id="set-table-font-val" class="settings-hint"></span>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.tableFontHint">Sets the file table size in any of the three fonts. Drag to preview.</p>
            <div class="settings-row">
              <label for="set-tracklist-font" data-i18n="settings.tracklistFont">Tracklist font size</label>
              <div class="settings-inline">
                <NativeSlider id="set-tracklist-font" min="10" max="16" step="1" />
                <span id="set-tracklist-font-val" class="settings-hint"></span>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.tracklistFontHint">Sets the tracklist size on release cards. Drag to preview.</p>
            <div class="settings-row">
              <span class="settings-label" data-i18n="settings.badgeFont">Release badge font</span>
              <div class="seg" id="set-badge-font" role="tablist" data-i18n-aria-label="settings.badgeFont" aria-label="Release badge font">
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-badge-font="mono" data-i18n="settings.font.mono">Mono</Button>
                <Button variant="ghost" size="sm" class="seg-btn" type="button" data-badge-font="sans" data-i18n="settings.font.sans">Sans</Button>
              </div>
            </div>
            <p class="settings-hint" data-i18n="settings.badgeFontHint">Sets the font for the catalogue number and track count on release cards. Mono makes 0 and 8 distinct and keeps numbers aligned.</p>
          </div>
        </div>
        </div>
        <div class="settings-foot">
          <span class="settings-hint" data-i18n="settings.savedHere">Saved to this machine.</span>
          <div class="spacer"></div>
          <Button variant="outline" size="sm" id="settings-cancel" data-i18n="action.cancel">Cancel</Button>
          <Button variant="default" size="sm" id="settings-save" class="primary" data-i18n="action.save">Save</Button>
        </div>
      </div>
    </div>


<style>
  .settings-label { font-size: var(--text-xs); color: var(--muted); }
</style>
