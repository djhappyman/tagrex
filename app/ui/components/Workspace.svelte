<script lang="ts">
  import DockWorkspace from './DockWorkspace.svelte';
  import DockModule from './DockModule.svelte';
  import type { WorkspaceLayout } from '$lib/workspace-layout';
  import FilterPanel from './FilterPanel.svelte';
  import NativeCheckbox from './controls/NativeCheckbox.svelte';
  import NativeSlider from './controls/NativeSlider.svelte';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as Tabs from '$lib/components/ui/tabs/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select/index.js';
  let dock = $state<WorkspaceLayout>();
  let mode = $state('tagger');
  let subtab = $state('online');
  // Narrow windows show one working pane at a time. Dock modules stay mounted, so
  // a cell edit, staged field or scroll position survives the switch.
  let viewOpen = $state(false);
  let moreOpen = $state(false);
  let generatorJob = $state<'transform' | 'number' | 'sides'>('transform');
  const compactQuery = typeof window === 'undefined' ? null : window.matchMedia('(max-width: 760px), (max-width: 900px) and (max-height: 520px)');
  let compact = $state(compactQuery?.matches ?? false);
  let compactActions = $state<HTMLElement>();
  let barHome: { parent: Node; next: ChildNode | null } | null = null;

  $effect(() => {
    if (!compactQuery) return;
    const onChange = (event: MediaQueryListEvent) => { compact = event.matches; };
    compactQuery.addEventListener('change', onChange);
    return () => compactQuery.removeEventListener('change', onChange);
  });
  // The staged-changes bar belongs to the table, but on a narrow inspector pane
  // there would be no way to reach Apply. Host the real bar (same IDs, same
  // controller state) above the status bar while the inspector is showing, and
  // put it back exactly where it was when the library returns.
  $effect(() => {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('diff-actionbar');
    const slot = compactActions;
    if (!bar || !slot) return;
    const hostIt = compact;
    if (hostIt && bar.parentElement !== slot) {
      if (!barHome || !barHome.parent.contains(bar)) barHome = { parent: bar.parentElement as Node, next: bar.nextSibling };
      slot.append(bar);
    } else if (!hostIt && bar.parentElement === slot && barHome) {
      barHome.parent.insertBefore(bar, barHome.next);
      if (!compact) barHome = null;
    }
  });
  function attachPaneRouting(node: HTMLElement) {
    const onClick = (event: MouseEvent) => {
      // Choosing a tool is a deliberate edit/search move: on a narrow window it
      // reveals that tool instead of leaving it below an unusable table slice.
      if ((event.target as Element).closest('.mode-tab')) dock?.reveal('inspector');
      if ((event.target as Element).closest('#gen-job-transform')) dock?.reveal('transformations');
    };
    const revealFiles = () => dock?.reveal('files');
    const revealModule = (event: Event) => dock?.reveal((event as CustomEvent<string>).detail);
    node.addEventListener('click', onClick);
    document.addEventListener('tagrex:focus-filter', revealFiles, true);
    document.addEventListener('tagrex:reveal-module', revealModule);
    return () => { node.removeEventListener('click', onClick); document.removeEventListener('tagrex:focus-filter', revealFiles, true); document.removeEventListener('tagrex:reveal-module', revealModule); };
  }
  // Both trigger panels stay in the DOM so the controller-owned buttons inside
  // keep their stable IDs. They are inert while closed rather than destroyed.
  $effect(() => {
    if (!viewOpen && !moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('#view-panel, #view-btn, #more-panel, #more-btn, .col-menu')) return;
      viewOpen = false;
      moreOpen = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (viewOpen) { viewOpen = false; requestAnimationFrame(() => document.getElementById('view-btn')?.focus()); }
      if (moreOpen) { moreOpen = false; requestAnimationFrame(() => document.getElementById('more-btn')?.focus()); }
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  });
  function openPanel(which: 'view' | 'more') {
    moreOpen = which === 'more' ? !moreOpen : false;
    viewOpen = which === 'view' ? !viewOpen : false;
    const panel = which === 'view' ? viewOpen : moreOpen;
    if (!panel) return;
    requestAnimationFrame(() => {
      const host = document.getElementById(which === 'view' ? 'view-panel' : 'more-panel');
      host?.querySelector<HTMLElement>('button:not([hidden]), input, select')?.focus();
    });
  }
  function attachTabs(node: HTMLDivElement) {
    const observer = new MutationObserver(() => {
      const activeMode = node.querySelector<HTMLElement>('.mode-tab.active')?.dataset.mode;
      const activeSubtab = node.querySelector<HTMLElement>('.subtab.active')?.dataset.subtab;
      if (activeMode && mode !== activeMode) mode = activeMode;
      if (activeSubtab && subtab !== activeSubtab) subtab = activeSubtab;
    });
    node.querySelectorAll('.mode-tab, .subtab').forEach(tab => observer.observe(tab, { attributes: true, attributeFilter: ['class'] }));
    return () => observer.disconnect();
  }
  function changeTab(value: string, subtab = false) {
    queueMicrotask(() => {
      const selector = subtab ? `.subtab[data-subtab="${value}"]` : `.mode-tab[data-mode="${value}"]`;
      const tab = document.querySelector<HTMLButtonElement>(selector);
      if (tab && !tab.classList.contains('active')) tab.click();
    });
  }
</script>
<div class="controller-tabs-layout" {@attach attachTabs} {@attach attachPaneRouting}>
<Tabs.Root bind:value={mode} class="controller-tabs-root" onValueChange={(value) => changeTab(value)}>

<header class="topbar" data-tauri-drag-region>

  <div class="topbar-main" data-tauri-drag-region>

    <div class="brand" role="img" aria-label="/tagrex/">
      <svg viewBox="0 0 470.61 93.61" aria-hidden="true" focusable="false"><path fill="currentColor" d="M38.38,0.00 L49.17,0.00 L10.80,82.19 L0.00,82.19 L38.38,0.00 Z M88.38,2.69 L88.38,18.22 L107.08,18.22 L107.08,29.20 L88.38,29.20 L88.38,55.08 Q88.38,58.75 90.16,60.34 Q91.94,61.92 96.10,61.92 L107.08,61.92 L107.08,72.91 L95.06,72.91 Q82.77,72.91 78.42,68.98 Q74.08,65.05 74.08,54.41 L74.08,29.20 L60.11,29.20 L60.11,18.22 L74.08,18.22 L74.08,2.69 L88.38,2.69 Z M149.08,47.22 Q141.07,47.22 137.89,49.28 Q134.72,51.33 134.72,56.30 Q134.72,60.02 136.91,62.22 Q139.11,64.41 142.88,64.41 Q148.54,64.41 151.66,60.14 Q154.79,55.86 154.79,48.20 L154.79,47.22 L149.08,47.22 Z M169.00,41.70 L169.00,72.91 L154.79,72.91 L154.79,66.80 Q152.21,70.42 148.14,72.38 Q144.10,74.33 139.21,74.33 Q129.88,74.33 124.68,69.39 Q119.49,64.45 119.49,55.62 Q119.49,46.05 125.69,41.48 Q131.89,36.92 144.88,36.92 L154.79,36.92 L154.79,34.53 Q154.79,31.06 152.27,29.28 Q149.75,27.50 144.88,27.50 Q139.75,27.50 134.94,28.80 Q130.13,30.08 124.91,32.92 L124.91,20.70 Q129.64,18.75 134.52,17.83 Q139.41,16.91 144.88,16.91 Q158.21,16.91 163.60,22.33 Q169.00,27.73 169.00,41.70 Z M214.30,44.69 Q214.30,37.36 211.52,32.94 Q208.74,28.52 204.21,28.52 Q199.71,28.52 196.94,32.92 Q194.19,37.31 194.19,44.69 Q194.19,52.11 196.94,56.50 Q199.71,60.89 204.21,60.89 Q208.74,60.89 211.52,56.48 Q214.30,52.06 214.30,44.69 Z M228.62,68.80 Q228.62,81.94 222.68,87.77 Q216.76,93.61 203.43,93.61 Q198.93,93.61 194.54,92.95 Q190.15,92.30 185.60,90.92 L185.60,77.80 Q189.65,80.03 193.85,81.11 Q198.05,82.19 202.49,82.19 Q208.55,82.19 211.43,79.33 Q214.30,76.47 214.30,70.42 L214.30,64.50 Q212.21,68.41 208.74,70.31 Q205.27,72.22 200.30,72.22 Q190.93,72.22 185.40,64.91 Q179.88,57.58 179.88,45.03 Q179.88,32.03 185.40,24.42 Q190.93,16.80 200.19,16.80 Q204.88,16.80 208.54,19.00 Q212.21,21.20 214.30,25.20 L214.30,18.22 L228.62,18.22 L228.62,68.80 Z M291.51,33.31 Q289.16,31.16 286.01,30.09 Q282.87,29.02 279.10,29.02 Q274.57,29.02 271.16,30.61 Q267.77,32.19 265.91,35.20 Q264.74,37.06 264.27,39.70 Q263.82,42.34 263.82,47.70 L263.82,72.91 L249.51,72.91 L249.51,18.22 L263.82,18.22 L263.82,26.72 Q265.91,22.03 270.26,19.47 Q274.62,16.91 280.43,16.91 Q283.35,16.91 286.15,17.61 Q288.96,18.31 291.51,19.69 L291.51,33.31 Z M349.32,70.22 Q344.34,72.27 339.17,73.30 Q333.99,74.33 328.23,74.33 Q314.51,74.33 307.26,66.98 Q300.01,59.62 300.01,45.81 Q300.01,32.42 306.98,24.67 Q313.96,16.91 326.03,16.91 Q338.18,16.91 344.90,24.11 Q351.62,31.30 351.62,44.39 L351.62,50.20 L314.56,50.20 Q314.60,56.64 318.35,59.83 Q322.12,63.00 329.59,63.00 Q334.53,63.00 339.31,61.58 Q344.09,60.16 349.32,57.08 L349.32,70.22 Z M337.21,39.45 Q337.12,33.80 334.31,30.89 Q331.49,27.98 326.03,27.98 Q321.10,27.98 318.17,30.98 Q315.24,33.98 314.70,39.50 L337.21,39.45 Z M411.62,18.22 L393.21,44.39 L413.23,72.91 L396.54,72.91 L385.79,54.50 L375.11,72.91 L358.40,72.91 L378.62,44.39 L360.01,18.22 L376.71,18.22 L385.79,34.53 L394.92,18.22 L411.62,18.22 Z M459.81,0.00 L470.61,0.00 L432.23,82.19 L421.44,82.19 L459.81,0.00 Z"/></svg>
    </div>

    <Tabs.List class="mode-tabs">
      <Tabs.Trigger value="tagger">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="mode-tab active" data-mode="tagger" data-i18n-title="mode.tagger.title" title="Edit tags from an online source, by hand, and manage cover art" aria-label="TAGGER"><svg class="ico"><use href="#i-tag"/></svg><span class="lbl">TAGGER</span></Button>
{/snippet}
</Tabs.Trigger>
      <Tabs.Trigger value="renamer">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="mode-tab" data-mode="renamer" data-i18n-title="mode.renamer.title" title="Rename files and move them into folders" aria-label="RENAMER"><svg class="ico"><use href="#i-rename"/></svg><span class="lbl">RENAMER</span></Button>
{/snippet}
</Tabs.Trigger>
      <Tabs.Trigger value="generator">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="mode-tab" data-mode="generator" data-i18n-title="mode.generator.title" title="Generate and clean up tag and file name values" aria-label="GENERATOR"><svg class="ico"><use href="#i-wand"/></svg><span class="lbl">GENERATOR</span></Button>
{/snippet}
</Tabs.Trigger>
      <Tabs.Trigger value="deduplicator">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="mode-tab" data-mode="deduplicator" data-i18n-title="mode.deduplicator.title" title="Find likely duplicate files in the open library" aria-label="DEDUPLICATOR"><svg class="ico"><use href="#i-dedup"/></svg><span class="lbl">DEDUPLICATOR</span></Button>
{/snippet}
</Tabs.Trigger>
      <Tabs.Trigger value="exporter">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="mode-tab" data-mode="exporter" data-i18n-title="mode.exporter.title" title="Export playlists, tables, and reports" aria-label="EXPORTER"><svg class="ico"><use href="#i-export"/></svg><span class="lbl">EXPORTER</span></Button>
{/snippet}
</Tabs.Trigger>
    </Tabs.List>
    <div class="view-tabs">


      <div class="toolbar-menus">
        <Button id="view-btn" variant="ghost" size="sm" class="toolbar-trigger" aria-expanded={viewOpen} aria-controls="view-panel" onclick={() => openPanel('view')}>
          <svg class="ico"><use href="#i-sliders"/></svg><span data-i18n="toolbar.view">View</span>
        </Button>
        <Button id="more-btn" variant="ghost" size="sm" class="toolbar-trigger" aria-expanded={moreOpen} aria-controls="more-panel" onclick={() => openPanel('more')}>
          <svg class="ico"><use href="#i-more"/></svg><span data-i18n="toolbar.more">More</span>
        </Button>
      </div>

      <div id="view-panel" class="toolbar-panel view-panel" class:open={viewOpen} role="group" aria-label="View options" data-i18n-aria-label="toolbar.viewPanel" aria-hidden={!viewOpen} inert={!viewOpen}>
        <div class="tray-row">
          <div class="col-picker group-ctl">
            <Button variant="ghost" size="sm" id="group-btn" class="tray-action" title="Group rows by a key. File order is unchanged." aria-label="Group rows by a key"><svg class="ico"><use href="#i-group"/></svg><span class="tray-label" data-i18n="toolbar.group">Group by</span></Button>
            <div id="group-menu" class="col-menu" hidden></div>
          </div>
          <Button variant="ghost" size="icon-sm" id="toggle-groups" class="icon tray-icon" hidden data-i18n-title="toolbar.collapseGroups" title="Collapse every group" data-i18n-aria-label="toolbar.collapseGroups" aria-label="Collapse every group"><svg class="ico"><use href="#i-collapse-all"/></svg></Button>
        </div>

        <div class="tray-row">
          <div class="col-picker">
            <Button variant="ghost" size="sm" id="columns-btn" class="tray-action" data-i18n-title="toolbar.columnsTitle" title="Choose which columns to show" data-i18n-aria-label="toolbar.columns" aria-label="Columns"><svg class="ico"><use href="#i-columns"/></svg><span class="tray-label" data-i18n="toolbar.columns">Columns</span></Button>
            <div id="columns-menu" class="col-menu" hidden></div>
          </div>
        </div>


        <div class="tray-row">
          <div class="col-picker">
            <Button variant="ghost" size="sm" id="health-btn" class="tray-action" data-i18n-title="health.title" title="Library health" data-i18n-aria-label="health.title" aria-label="Library health"><svg class="ico"><use href="#i-health"/></svg><span class="tray-label" data-i18n="health.title">Library health</span><span id="health-n" class="field-count"></span></Button>
            <div id="health-menu" class="col-menu" hidden></div>
          </div>
        </div>
      </div>

      <div id="more-panel" class="toolbar-panel more-panel" class:open={moreOpen} role="group" aria-label="Selection actions" data-i18n-aria-label="toolbar.morePanel" aria-hidden={!moreOpen} inert={!moreOpen}>
        <div class="tray-row transform-row">
          <Button variant="ghost" size="sm" id="transform-btn" class="tray-action" data-i18n-title="toolbar.transformTitle" title="Rules to run on the values this panel produces" data-i18n-aria-label="toolbar.transform" aria-label="Transform values"><svg class="ico"><use href="#i-wand"/></svg><span class="tray-label" data-i18n="toolbar.transform">Transform values</span></Button>
        </div>
        <div class="tray-row">
          <Button variant="ghost" size="sm" id="detect-bpm" class="tray-action search-toggle" title="Detect BPM" aria-label="Detect BPM"><svg class="ico glyph-search"><use href="#i-metronome"/></svg><svg class="ico glyph-stop"><use href="#i-stop"/></svg><span class="tray-label" data-i18n="toolbar.detectBpm">Detect BPM</span></Button>
        </div>
        <div class="tray-row">
          <Button variant="ghost" size="sm" id="clear-tags" class="tray-action danger" data-i18n-title="toolbar.clearTagsTitle" title="Clears text tags on the selected files. Cover art and DJ cue points are kept. Previewed before anything is written." data-i18n-aria-label="toolbar.clearTags" aria-label="Clear text tags on the selected files"><svg class="ico"><use href="#i-eraser"/></svg><span class="tray-label" data-i18n="editor.clearTags">Clear tags</span></Button>
        </div>
      </div>
    </div>
    <div class="spacer" data-tauri-drag-region></div>

    <span id="update-pill" class="update-pill" hidden>
      <Button variant="outline" size="sm" id="update-open" class="update-open" type="button"></Button>
      <Button variant="ghost" size="icon-sm" id="update-notes" class="update-notes icon" type="button" hidden data-i18n-title="update.notes" title="What's new in this version" data-i18n-aria-label="update.notes" aria-label="What's new in this version"><svg class="ico"><use href="#i-doc"/></svg></Button>
      <Button variant="ghost" size="icon-sm" id="update-skip" class="update-skip icon" type="button" data-i18n-title="update.skip" title="Don't tell me about this version" data-i18n-aria-label="update.skip" aria-label="Don't tell me about this version"><svg class="ico"><use href="#i-close"/></svg></Button>
    </span>

    <Button variant="ghost" size="icon-sm" id="undo" class="icon" disabled data-i18n-title="topbar.undo" title="Undo the last applied batch" data-i18n-aria-label="topbar.undo" aria-label="Undo the last applied batch"><svg class="ico"><use href="#i-undo"/></svg></Button>
    <Button variant="ghost" size="icon-sm" id="settings-open" class="icon gear" data-i18n-title="topbar.settings" title="Settings" data-i18n-aria-label="topbar.settings" aria-label="Settings"><svg class="ico"><use href="#i-settings"/></svg></Button>
    <span class="topbar-div" aria-hidden="true"></span>
    <Button variant="ghost" size="icon-sm" id="panel-toggle" class="icon" data-i18n-title="topbar.collapsePanelTitle" title="Collapse the mode panel to give the table more room." data-i18n-aria-label="topbar.collapsePanel" aria-label="Collapse the mode panel"><svg class="ico"><use href="#i-collapse"/></svg></Button>
  </div>

  <div class="lib">

    <div id="root-field" class="field">
      <div id="root-box" class="path">
        <Button variant="ghost" size="sm" id="root-display" class="path-open field-value" type="button" data-i18n-title="topbar.chooseFolder" title="Choose a folder to open">
          <span class="path-parent"></span><span class="path-name">No folder open</span>
        </Button>
      </div>
      <Input id="root" type="text" data-i18n-placeholder="topbar.pathPlaceholder" placeholder="/path/to/music/library" spellcheck="false" hidden />
      <div class="field-tools">
        <Button variant="ghost" size="icon-sm" id="root-recent" class="icon" type="button" data-i18n-title="topbar.recent" title="Recently opened folders" data-i18n-aria-label="topbar.recent" aria-label="Recently opened folders" aria-expanded="false" hidden><svg class="ico"><use href="#i-caret-down"/></svg></Button>
        <span class="field-sep" aria-hidden="true"></span>
        <Button variant="ghost" size="icon-sm" id="lib-action" class="icon" data-i18n-title="topbar.chooseFolder" title="Choose a folder to open" data-i18n-aria-label="topbar.chooseFolder" aria-label="Choose a folder to open"><svg class="ico"><use id="lib-action-glyph" href="#i-folder"/></svg></Button>
      </div>
      <div id="root-recent-menu" class="col-menu" hidden></div>
    </div>

    <Button variant="ghost" size="icon-sm" id="lib-refresh" class="icon" data-i18n-title="topbar.reread" title="Re-read the open folder" data-i18n-aria-label="topbar.reread" aria-label="Re-read the open folder" disabled><svg class="ico"><use href="#i-refresh"/></svg></Button>
  </div>
</header>

<main class="workarea">

  <DockWorkspace bind:controller={dock}>
  <DockModule moduleId="files" title="Files" defaultArea="left" chromeTarget=".view-tabs">
  <section class="files-col">


    <div id="files-view" class="table-wrap">
      <Table.Root id="tracks" containerClass="contents">
        <Table.Header>
          <tr>
            <th class="sel"><NativeCheckbox id="select-all" /></th>
            <th data-sort="file" class="sortable"><span data-i18n="column.file">File</span><span class="sort-ind"></span></th>
            <th data-sort="artist" class="sortable"><span data-i18n="field.artist">Artist</span><span class="sort-ind"></span></th>
            <th data-sort="title" class="sortable"><span data-i18n="field.title">Title</span><span class="sort-ind"></span></th>
            <th data-sort="album" class="sortable"><span data-i18n="field.album">Album</span><span class="sort-ind"></span></th>
            <th data-sort="year" class="sortable"><span data-i18n="field.year">Year</span><span class="sort-ind"></span></th>
          </tr>
        </Table.Header>
        <Table.Body id="tracks-body" />
      </Table.Root>
      <p id="tracks-empty" class="empty inert-panel" data-i18n="table.empty">Open a folder to list its tracks.</p>
    </div>

    <FilterPanel>
      <div class="filter-ctl field is-empty">

        <span id="filter-check" class="field-chip" hidden><span id="filter-check-name"></span><Button variant="ghost" size="icon-sm" id="filter-check-clear" class="icon" type="button" data-i18n-title="health.clear" title="Show all files" data-i18n-aria-label="health.clear" aria-label="Show all files"><svg class="ico"><use href="#i-close"/></svg></Button></span>
        <Input id="filter" type="search" data-i18n-placeholder="toolbar.filterPlaceholder" placeholder="Filter (try artist:aphex)" spellcheck="false" />
        <div class="field-tools">
          <Button variant="ghost" size="icon-sm" id="filter-clear" class="icon field-clear" type="button" data-i18n-title="toolbar.clearFilter" title="Clear the filter" data-i18n-aria-label="toolbar.clearFilter" aria-label="Clear the filter"><svg class="ico"><use href="#i-close"/></svg></Button>
          <span class="field-sep" aria-hidden="true"></span>
          <Button variant="ghost" size="sm" id="filter-regex" class="field-flag" type="button" data-i18n-title="toolbar.regex" title="Regular-expression mode" aria-pressed="false">.*</Button>
          <Button variant="ghost" size="sm" id="filter-case" class="field-flag" type="button" data-i18n-title="toolbar.caseSensitive" title="Case-sensitive" aria-pressed="false">Aa</Button>
        </div>
      </div>
      <div class="filter-presets">
          <div class="col-picker">
            <Button variant="ghost" size="sm" id="presets-btn" class="tray-action" data-i18n-title="toolbar.presetsTitle" title="Save and reuse filter and sort presets" data-i18n-aria-label="toolbar.presets" aria-label="Filter and sort presets"><svg class="ico"><use href="#i-presets"/></svg><span class="tray-label" data-i18n="toolbar.presets">Filter and sort presets</span></Button>
            <div id="presets-menu" class="col-menu" hidden></div>
          </div>
        </div>
    </FilterPanel>

    <div id="duplicates-view" hidden>
      <div class="dup-bar">
        <span id="dup-summary" class="hint muted" style="padding: 0"></span>
        <div class="spacer"></div>
        <span class="ro-note"><svg class="ico"><use href="#i-lock"/></svg> <span data-i18n="dedup.readonly">Read-only. Nothing is changed.</span></span>
      </div>
      <div id="dup-results" class="dup-wrap"></div>
    </div>

    <div id="diff-actionbar" class="diff-actionbar" hidden>
      <span class="ab-count"><b id="ab-count">0</b> <span data-i18n="diff.toApply">to apply</span><span class="ab-plan" id="ab-plan"></span><span class="ab-locked" id="ab-locked" hidden></span></span>
      <span class="ab-sep"></span>
      <label class="toggle-old" data-i18n-title="diff.showOldTitle" title="Shows the old value under each changed cell."><NativeCheckbox id="diff-show-old" /> <span data-i18n="diff.showOld">Show old values</span></label>
      <span class="ab-sep"></span>
      <span class="ab-progress" id="ab-progress"><span class="ab-bar"><span class="ab-bar-fill" id="ab-bar-fill"></span></span><span class="ab-file" id="ab-file"></span></span>
      <Button variant="outline" size="sm" id="diff-cancel-apply" class="btn" data-i18n="action.cancel">Cancel</Button>
      <Button variant="outline" size="sm" id="diff-discard" class="btn" data-i18n="action.discard">Discard</Button>
      <Button variant="default" size="sm" id="diff-apply" class="btn primary" disabled data-i18n="action.apply">Apply</Button>
    </div>
  </section>

  </DockModule>

  <Button variant="ghost" id="col-splitter" hidden class="col-splitter" role="separator" tabindex={0} aria-valuenow={480} aria-valuemin={240} aria-valuemax={1200} aria-orientation="vertical" aria-label="Resize editor panel" aria-controls="panel-tagger panel-renamer panel-generator panel-deduplicator panel-exporter" data-i18n-title="toolbar.dragResize" title="Drag to resize" />

  <DockModule moduleId="inspector" title="Inspector" defaultArea="right" defaultIndex={1} headerless>
  <aside class="mode-col" id="mode-col">

    <Tabs.Content value="renamer" id="panel-renamer" class="mode-panel" hidden>
      <div class="panel-block">
        <h2 data-i18n="renamer.heading">Rename files</h2>
        <div class="mask-row">
          <div class="field">
            <Input id="mask" type="text" value="%artist% - %title%" spellcheck="false" placeholder="%artist% - %title%" />
            <div class="field-tools">
              <Button variant="ghost" size="icon-sm" class="icon ph-btn" type="button" data-ph-target="mask" data-i18n-title="mask.placeholders" title="Placeholders" data-i18n-aria-label="mask.placeholdersAria" aria-label="Placeholder reference"><svg class="ico"><use href="#i-help"/></svg></Button>
              <Button variant="ghost" size="icon-sm" class="icon preset-btn" type="button" data-preset-target="mask" data-i18n-title="preset.title" title="Mask presets" data-i18n-aria-label="preset.title" aria-label="Mask presets"><svg class="ico"><use href="#i-presets"/></svg></Button>

              <Button variant="ghost" size="icon-sm" id="mask-builder-open" class="icon" type="button" data-i18n-title="maskBuilder.open" title="Open the mask builder" data-i18n-aria-label="maskBuilder.open" aria-label="Open the mask builder"><svg class="ico"><use href="#i-builder"/></svg></Button>
            </div>
          </div>
        </div>

        <p id="mask-example" class="hint mono mask-example" aria-live="polite"></p>

        <details class="panel-help">
          <summary data-i18n="renamer.hintSummary">How masks work</summary>
          <p class="hint mask-hint" data-i18n="renamer.maskHint" data-i18n-html>The <span class="hint-tool">?</span> button lists placeholders, optional parts, widths and folders. The builder tries the mask on every selected file. Add <code>/</code> to sort files into folders.</p>
        </details>

        <label class="rule-flag" data-i18n-title="settings.sidecarsHint" title="Same-named files (lyrics, cue sheets, per-track covers) move with a renamed or moved track, and undo restores them together. A file already at the destination is never overwritten.">
          <NativeCheckbox id="carry-sidecars" checked /><span data-i18n="renamer.carrySidecars">Carry same-named files (lyrics, cue sheets…)</span>
        </label>
        <label class="rule-flag" data-i18n-title="renamer.reorganizeToggleTitle" title="Move or copy the renamed files into another folder">
          <NativeCheckbox id="reorganize-toggle" /><span data-i18n="renamer.reorganizeToggle">Move or copy into another folder</span>
        </label>

        <div id="reorganize-options" hidden>

          <label class="export-row"
            ><span data-i18n="renamer.into">Into</span>

            <span class="field is-path">
              <Input id="move-dest" type="text" spellcheck="false" data-i18n-placeholder="renamer.intoPlaceholder" placeholder="the opened library" readonly data-i18n-title="renamer.chooseTitle" title="Choose a destination folder" />
              <span class="field-tools">
                <Button variant="ghost" size="icon-sm" id="move-dest-clear" class="icon field-clear" type="button" data-i18n-title="renamer.backToLibrary" title="Back to the opened library" data-i18n-aria-label="renamer.backToLibrary" aria-label="Back to the opened library"><svg class="ico"><use href="#i-close"/></svg></Button>
                <span class="field-sep" aria-hidden="true"></span>
                <Button variant="ghost" size="icon-sm" id="move-dest-pick" class="icon" type="button" data-i18n-title="renamer.chooseTitle" title="Choose a destination folder" data-i18n-aria-label="renamer.chooseTitle" aria-label="Choose a destination folder"><svg class="ico"><use href="#i-folder"/></svg></Button>
              </span>
            </span>
          </label>
          <div class="export-row move-mode-row">
            <span data-i18n="renamer.files">Files</span>
            <div class="seg" id="move-mode" role="tablist" data-i18n-aria-label="renamer.moveOrCopy" aria-label="Move or copy">
              <Button variant="ghost" size="sm" class="seg-btn active" type="button" data-move-mode="move" data-i18n="renamer.move">Move</Button>
              <Button variant="ghost" size="sm" class="seg-btn" type="button" data-move-mode="copy" data-i18n="renamer.copy">Copy</Button>
            </div>
            <label class="rule-flag" data-i18n-title="renamer.pruneTitle" title="Remove folders this move leaves empty. Undo puts them back.">
              <NativeCheckbox id="move-prune" /><span data-i18n="renamer.prune">Tidy up empty folders</span>
            </label>
          </div>

          <label class="rule-flag carry-extras-flag" data-i18n-title="settings.extrasHint" title="When a reorganize empties a folder, everything left in it (a rip log, loose artwork, a Scans subfolder) moves to the same destination. A folder that still holds other music, or files that scatter to several destinations, is left alone.">
            <NativeCheckbox id="carry-extras" checked /><span data-i18n="renamer.carryExtras">Carry the rest of the folder (art, rip log, scans)</span>
          </label>
        </div>

        <div class="panel-actions">
          <Button variant="default" size="sm" id="preview" class="primary" data-i18n="renamer.previewRename">Preview</Button>
        </div>
      </div>
    </Tabs.Content>

    <Tabs.Content value="tagger" id="panel-tagger" class="mode-panel">
<Tabs.Root bind:value={subtab} class="controller-tabs-root" onValueChange={(value) => changeTab(value, true)}>
      <Tabs.List class="subtabs" data-i18n-aria-label="tagger.mode" aria-label="Tagging mode">
        <Tabs.Trigger value="online">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="subtab active" data-subtab="online" type="button" data-i18n="tagger.online">ONLINE</Button>
{/snippet}
</Tabs.Trigger>
        <Tabs.Trigger value="editor">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="subtab" data-subtab="editor" type="button" data-i18n="tagger.editor">EDITOR</Button>
{/snippet}
</Tabs.Trigger>
        <Tabs.Trigger value="filename">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="subtab" data-subtab="filename" type="button" data-i18n="tagger.fromName">FROM NAME</Button>
{/snippet}
</Tabs.Trigger>
        <Tabs.Trigger value="fromtext">
{#snippet child({ props })}
<Button {...props} data-slot="button" variant="ghost" size="sm" class="subtab" data-subtab="fromtext" type="button" data-i18n="tagger.fromText">FROM TEXT</Button>
{/snippet}
</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="online" id="subtab-online" class="subtab-panel online">
        <div class="online-head">
          <div class="online-head-row">
            <label class="source-label"
              ><span data-i18n="online.source">Source</span>
              <NativeSelect size="sm" id="online-source" data-i18n-title="online.sourceTitle" title="Metadata source">
                <NativeSelectOption value="discogs">Discogs</NativeSelectOption>
                <NativeSelectOption value="musicbrainz">MusicBrainz</NativeSelectOption>
                <NativeSelectOption value="beatport">Beatport</NativeSelectOption>
                <NativeSelectOption value="bandcamp">Bandcamp</NativeSelectOption>
                <NativeSelectOption value="soundeo">Soundeo</NativeSelectOption>
              </NativeSelect>
            </label>
            <div class="spacer"></div>

            <NativeSelect size="sm" id="search-format" data-i18n-title="online.mediaFilter" title="Filter results by media type">
              <NativeSelectOption value="" data-i18n="online.allMedia">All media</NativeSelectOption>
              <NativeSelectOption value="CD">CD</NativeSelectOption>
              <NativeSelectOption value="Vinyl" data-i18n="media.vinyl">Vinyl</NativeSelectOption>
              <NativeSelectOption value="LP">LP</NativeSelectOption>
              <NativeSelectOption value="Cassette" data-i18n="media.cassette">Cassette</NativeSelectOption>
              <NativeSelectOption value="File" data-i18n="media.file">File</NativeSelectOption>
            </NativeSelect>
          </div>
          <div class="mask-row">

            <div id="query-box" class="query field">
              <Input id="discogs-query" type="text" data-i18n-placeholder="online.queryPlaceholder" placeholder="artist / album / catalog no." spellcheck="false" />
              <div class="field-tools">
                <Button variant="ghost" size="icon-sm" id="query-presets" class="icon" type="button" data-i18n-title="online.presets" title="Queries this selection can build" data-i18n-aria-label="online.presets" aria-label="Queries this selection can build" aria-expanded="false"><svg class="ico"><use href="#i-caret-down"/></svg></Button>
              </div>
              <div id="query-preset-menu" class="col-menu" hidden></div>
            </div>

            <Button variant="ghost" size="icon-sm" id="discogs-search" class="icon search-toggle" data-i18n-title="online.search" title="Search" data-i18n-aria-label="online.search" aria-label="Search">
              <svg class="glyph glyph-search" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.3" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="10.3" y1="10.3" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              <svg class="glyph glyph-stop" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/></svg>
            </Button>
          </div>
          <div class="release-toolbar" id="release-toolbar" hidden>
            <span class="hint muted" id="release-found" data-i18n="online.foundNone">Found 0 entries</span>
            <div class="spacer"></div>
            <label class="hint muted" data-i18n-title="online.vinylDiscTitle" title="On import, map a vinyl side (A1/B2) to the disc number: side A → disc 1, B → disc 2, …">
              <NativeCheckbox id="import-vinyl-disc" /> <span data-i18n="online.vinylDisc">Vinyl side → disc</span>
            </label>
            <label class="hint muted per-page"><span data-i18n="online.show">Show</span>
              <NativeSelect size="sm" id="search-per-page" data-i18n-title="online.perPage" title="Results per page">
                <NativeSelectOption value="5" selected>5</NativeSelectOption>
                <NativeSelectOption value="10">10</NativeSelectOption>
                <NativeSelectOption value="15">15</NativeSelectOption>
              </NativeSelect>
            </label>
          </div>
        </div>
        <div class="online-scroll">

          <div id="release-list" class="release-list"></div>
          <p id="discogs-empty" class="empty inert-panel" data-i18n="online.empty">Search the selected source to see releases.</p>
        </div>

        <div id="release-more" class="release-more" hidden>
          <Button variant="outline" size="sm" id="load-more" type="button" data-i18n="online.loadMore">More</Button>
        </div>
      </Tabs.Content>

      <Tabs.Content value="editor" id="subtab-editor" class="subtab-panel editor" hidden>
        <div class="editor-scroll">
          <div class="panel-block">
            <span id="fields-count" hidden></span>

            <p id="fields-blocks" class="hint muted" style="padding: 0" hidden></p>

            <div id="fields-blocks-convert" class="blocks-convert" hidden></div>

            <div id="fields-body" class="fe"></div>

          </div>

          <div class="panel-block">
            <h2 data-i18n="editor.coverArt">Cover art</h2>

            <div id="cover-well"></div>

            <div id="cover-set" class="cover-set" hidden></div>
          </div>
        </div>

        <div class="panel-actions editor-actions">
          <Button variant="outline" size="sm" id="fields-clear" data-i18n-title="editor.clearTagsTitle" title="Clears every text tag on the selected files. Cover art and DJ cue points are kept. Undo restores them." data-i18n="editor.clearTags">Clear tags</Button>
          <div class="spacer"></div>
          <Button variant="default" size="sm" id="fields-apply" class="primary" data-i18n="editor.stageFields">Stage</Button>
        </div>
      </Tabs.Content>

      <Tabs.Content value="filename" id="subtab-filename" class="subtab-panel from-name" hidden>
        <div class="from-name-scroll"><div class="panel-block">
          <h2 data-i18n="fromName.heading">Tags from the file name</h2>
          <div class="mask-row">
            <div class="field">
              <Input id="from-name-mask" type="text" value="%artist% - %title%" spellcheck="false" placeholder="%artist% - %title%" />
              <div class="field-tools">
                <Button variant="ghost" size="icon-sm" class="icon ph-btn" type="button" data-ph-target="from-name-mask" data-i18n-title="mask.placeholders" title="Placeholders" data-i18n-aria-label="mask.placeholdersAria" aria-label="Placeholder reference"><svg class="ico"><use href="#i-help"/></svg></Button>
                <Button variant="ghost" size="icon-sm" class="icon preset-btn" type="button" data-preset-target="from-name-mask" data-i18n-title="preset.title" title="Mask presets" data-i18n-aria-label="preset.title" aria-label="Mask presets"><svg class="ico"><use href="#i-presets"/></svg></Button>

                <Button variant="ghost" size="icon-sm" id="from-name-builder-open" class="icon" type="button" data-i18n-title="maskBuilder.open" title="Open the mask builder" data-i18n-aria-label="maskBuilder.open" aria-label="Open the mask builder"><svg class="ico"><use href="#i-builder"/></svg></Button>
              </div>
            </div>
          </div>

          <div id="from-name-probe" class="probe"></div>

          <details class="panel-help">
            <summary data-i18n="fromName.hintSummary">How the mask is read</summary>
            <p class="hint mask-hint" data-i18n="fromName.hint" data-i18n-html>A name that does not fit the mask is left alone. <span class="hint-tool">?</span> lists the placeholders and grammar, read in reverse. The builder tries the mask on every selected file.</p>
          </details>
        </div></div>
        <div class="panel-actions from-name-actions">
          <Button variant="default" size="sm" id="from-name-preview" class="primary" data-i18n="fromName.preview">Preview</Button>
        </div>
      </Tabs.Content>

      <Tabs.Content value="fromtext" id="subtab-fromtext" class="subtab-panel from-name" hidden>
        <div class="from-name-scroll"><div class="panel-block">
          <h2 data-i18n="fromText.heading">Tags from a text list</h2>
          <div class="mask-row">
            <div class="field">
              <Input id="from-text-mask" type="text" value="%track%. %artist% - %title%" spellcheck="false" placeholder="%track%. %artist% - %title%" />
              <div class="field-tools">
                <Button variant="ghost" size="icon-sm" class="icon ph-btn" type="button" data-ph-target="from-text-mask" data-i18n-title="mask.placeholders" title="Placeholders" data-i18n-aria-label="mask.placeholdersAria" aria-label="Placeholder reference"><svg class="ico"><use href="#i-help"/></svg></Button>
                <Button variant="ghost" size="icon-sm" class="icon preset-btn" type="button" data-preset-target="from-text-mask" data-i18n-title="preset.title" title="Mask presets" data-i18n-aria-label="preset.title" aria-label="Mask presets"><svg class="ico"><use href="#i-presets"/></svg></Button>

                <Button variant="ghost" size="icon-sm" id="from-text-builder-open" class="icon" type="button" data-i18n-title="maskBuilder.open" title="Open the mask builder" data-i18n-aria-label="maskBuilder.open" aria-label="Open the mask builder"><svg class="ico"><use href="#i-builder"/></svg></Button>
              </div>
            </div>
          </div>
          <div class="from-text-head">
            <span id="from-text-count" class="muted"></span>
            <Button variant="outline" size="sm" id="from-text-suggest" type="button" data-i18n="fromText.suggest" data-i18n-title="fromText.suggestTitle" title="Builds a mask from the list layout: columns, numbering, dashes and lengths.">Suggest</Button>
            <Button variant="outline" size="sm" id="from-text-load" type="button" data-i18n="fromText.load">Open</Button>
          </div>
          <Textarea id="from-text-lines" class="from-text-lines" spellcheck="false" wrap="off" data-i18n-placeholder="fromText.placeholder" placeholder="Paste a tracklist, one line per track" />
          <div id="from-text-probe" class="probe"></div>

          <details class="panel-help">
            <summary data-i18n="fromText.hintSummary">How lines are matched</summary>
            <p class="hint mask-hint" data-i18n="fromText.hint" data-i18n-html>One line per selected file, in table order. Lines that do not fit are skipped. <span class="hint-tool">?</span> lists the grammar. The builder shows every line.</p>
          </details>
        </div></div>
        <div class="panel-actions from-name-actions">
          <Button variant="default" size="sm" id="from-text-preview" class="primary" data-i18n="fromName.preview">Preview</Button>
        </div>
      </Tabs.Content>
    </Tabs.Root>
</Tabs.Content>

    <Tabs.Content value="generator" id="panel-generator" class="mode-panel" hidden>

      <div class="gen-jobs" role="tablist" aria-label="Generator job" data-i18n-aria-label="generator.jobs">
        <Button id="gen-job-transform" variant="ghost" size="sm" class="gen-job" role="tab" aria-selected={generatorJob === 'transform'} onclick={() => generatorJob = 'transform'} data-i18n="generator.job.transform">Transform</Button>
        <Button id="gen-job-number" variant="ghost" size="sm" class="gen-job" role="tab" aria-selected={generatorJob === 'number'} onclick={() => generatorJob = 'number'} data-i18n="generator.job.number">Number</Button>
        <Button id="gen-job-sides" variant="ghost" size="sm" class="gen-job" role="tab" aria-selected={generatorJob === 'sides'} onclick={() => generatorJob = 'sides'} data-i18n="generator.job.sides">Vinyl sides</Button>
      </div>

      <p class="hint muted" hidden={generatorJob !== 'transform'}>Select presets in the Transformations module.</p>

      <div class="panel-block" hidden={generatorJob !== 'number'}>
        <h2><span data-i18n="generator.numberTracks">Number tracks</span> <span id="autonum-count" class="muted"></span></h2>
        <p class="hint muted" style="padding: 0" data-i18n="generator.numberHint">Writes track numbers in table order.</p>

        <div class="panel-actions">
          <span class="panel-field"><label for="autonum-start" data-i18n="generator.startAt">Start at</label><Input id="autonum-start" type="number" min="0" step="1" value="1" /></span>
          <span class="panel-field"><label for="autonum-disc" data-i18n="generator.discNo">Disc #</label><Input id="autonum-disc" type="text" data-i18n-placeholder="generator.discPlaceholder" placeholder="none" data-i18n-title="generator.discTitle" title="Write this disc number to every numbered file. Leave it blank to keep each file's disc number." spellcheck="false" /></span>
          <label class="rule-flag" data-i18n-title="generator.trackTotalTitle" title="Also writes the track total, the number of files being numbered, to every file.">
            <NativeCheckbox id="autonum-total" /><span data-i18n="generator.trackTotal">Track total</span>
          </label>
          <label class="rule-flag" data-i18n-title="generator.perGroupTitle" title="Restarts at the start value for each group when grouping is on.">
            <NativeCheckbox id="autonum-per-group" /><span data-i18n="generator.perGroup">Restart per group</span>
          </label>
          <label class="rule-flag" data-i18n-title="generator.keepSidesTitle" title="Leaves positions like A1 or B2 unchanged instead of renumbering them.">
            <NativeCheckbox id="autonum-keep-sides" checked /><span data-i18n="generator.keepSides">Keep vinyl sides</span>
          </label>
          <Button variant="default" size="sm" id="autonum-run" class="primary" data-i18n="generator.numberRun">Number</Button>
        </div>
      </div>

      <div class="panel-block" hidden={generatorJob !== 'sides'}>
        <h2><span data-i18n="generator.vinylSides">Vinyl sides</span> <span id="vinyl-count" class="muted"></span></h2>

        <div class="panel-actions">
          <p class="panel-note" data-i18n="generator.vinylHint" data-i18n-html>Side A becomes disc 1, side B disc 2. <b>A1</b> becomes track 1. Rows without a side letter stay as they are.</p>
          <Button variant="default" size="sm" id="vinyl-split" class="primary" data-i18n="generator.splitSide">Split</Button>
        </div>
      </div>
    </Tabs.Content>

    <Tabs.Content value="deduplicator" id="panel-deduplicator" class="mode-panel" hidden>
      <div class="panel-block">
        <h2 data-i18n="dedup.heading">Find duplicates</h2>
        <p class="hint muted" style="padding: 0" data-i18n="dedup.hint">
          Scan the library for likely duplicates using the key you choose.
        </p>
        <label class="export-row"
          ><span data-i18n="dedup.by">By</span>
          <NativeSelect size="sm" id="dup-criterion" data-i18n-title="dedup.criterion.title" title="Choose how to match duplicate files">
            <NativeSelectOption value="artist_title" data-i18n="dedup.criterion.artistTitle">Artist + Title</NativeSelectOption>
            <NativeSelectOption value="album_track" data-i18n="dedup.criterion.albumTrack">Album + Track</NativeSelectOption>
            <NativeSelectOption value="duration" data-i18n="dedup.criterion.duration">Duration</NativeSelectOption>
            <NativeSelectOption value="size" data-i18n="dedup.criterion.size">File size</NativeSelectOption>
            <NativeSelectOption value="hash" data-i18n="dedup.criterion.hash">Identical bytes</NativeSelectOption>
          </NativeSelect>
        </label>

        <div class="panel-actions">
          <p class="ro-note panel-note"><svg class="ico"><use href="#i-lock"/></svg> <span data-i18n="dedup.readonly">Read-only. Nothing is changed.</span></p>
          <Button variant="default" size="sm" id="dup-scan" class="primary" data-i18n="dedup.scan">Scan</Button>
        </div>
      </div>
    </Tabs.Content>

    <Tabs.Content value="exporter" id="panel-exporter" class="mode-panel" hidden>
      <div class="panel-block">
        <h2><span data-i18n="exporter.heading">Export</span> <span id="export-count" class="muted"></span></h2>

        <div class="exp-format">
          <span class="exp-format-label" data-i18n="exporter.format">Format</span>
          <div class="exp-seg" id="export-kind" role="tablist" data-i18n-aria-label="exporter.format.aria" aria-label="Export format">
            <Button variant="ghost" size="sm" class="seg-btn active" type="button" data-fmt="playlist" data-i18n="exporter.format.playlist">Playlist</Button>
            <Button variant="ghost" size="sm" class="seg-btn" type="button" data-fmt="cue" data-i18n="exporter.format.cue">CUE</Button>
            <Button variant="ghost" size="sm" class="seg-btn" type="button" data-fmt="csv" data-i18n="exporter.format.csv">CSV</Button>
            <Button variant="ghost" size="sm" class="seg-btn" type="button" data-fmt="html" data-i18n="exporter.format.html">HTML</Button>
            <Button variant="ghost" size="sm" class="seg-btn" type="button" data-fmt="xml" data-i18n="exporter.format.xml">XML</Button>
            <Button variant="ghost" size="sm" class="seg-btn" type="button" data-fmt="report" data-i18n="exporter.format.report">Report</Button>
          </div>
          <p class="exp-format-hint" id="export-hint"></p>
        </div>

        <div class="exp-fields">

          <div class="exp-mask" id="export-split-row">
            <label for="export-split" data-i18n="exporter.split">One per</label>
            <NativeSelect size="sm" id="export-split">
              <NativeSelectOption value="" data-i18n="exporter.split.selection">Selection</NativeSelectOption>
              <NativeSelectOption value="folder" data-i18n="exporter.split.folder">Folder</NativeSelectOption>
              <NativeSelectOption value="album" data-i18n="exporter.split.album">Album</NativeSelectOption>
            </NativeSelect>
          </div>

          <div class="exp-mask" id="export-mask-row">
            <label for="export-mask" data-i18n="exporter.mask">Mask</label>

            <div class="field">
              <Input id="export-mask" type="text" value="%artist% - %title%" spellcheck="false" />
              <div class="field-tools">
                <Button variant="ghost" size="icon-sm" class="icon ph-btn" type="button" data-ph-target="export-mask" data-i18n-title="mask.placeholders" title="Placeholders" data-i18n-aria-label="mask.placeholdersAria" aria-label="Placeholder reference"><svg class="ico"><use href="#i-help"/></svg></Button>
                <Button variant="ghost" size="icon-sm" class="icon preset-btn" type="button" data-preset-target="export-mask" data-i18n-title="preset.title" title="Mask presets" data-i18n-aria-label="preset.title" aria-label="Mask presets"><svg class="ico"><use href="#i-presets"/></svg></Button>
              </div>
            </div>
          </div>
          <div class="exp-row">
            <label for="export-name" id="export-name-label">File name</label>
            <Input id="export-name" type="text" spellcheck="false" />
          </div>
        </div>

        <div class="panel-actions">
          <p class="exp-note panel-note" data-i18n="exporter.note" data-i18n-html><b>Read-only.</b> Writes into the opened library folder. Your audio files are not modified.</p>
          <Button variant="default" size="sm" id="export-run" class="primary" data-i18n="exporter.run">Export</Button>
        </div>
      </div>
    </Tabs.Content>

  </aside>
  </DockModule>
  <DockModule moduleId="transformations" title="Transformations" defaultArea="right" defaultIndex={0} defaultWeight={0.6} chromeTarget="h2" collapsible>
  {#snippet headerHelp()}
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}<Button {...props} variant="ghost" size="icon-sm" class="transformation-help" aria-label="About transformations">?</Button>{/snippet}
      </Popover.Trigger>
      <Popover.Content class="transformation-help-content" align="start">
        <p data-i18n="generator.transformHint">Ticked presets run in list order. Nothing is written until you review the preview and press Apply.</p>
      </Popover.Content>
    </Popover.Root>
  {/snippet}
  {#snippet headerActions()}
    <Button variant="outline" size="sm" id="presets-edit" class="btn" type="button" data-i18n="presets.edit">Edit</Button>
  {/snippet}
  <div class="docked-transformations">
      <div id="transform-home"></div>
      <div id="transform-block" class="panel-block">
        <h2><span data-i18n="workspace.transformations">Transformations</span><span id="transform-count" hidden></span></h2>
        <p id="transform-context-note" class="hint inert-panel" style="padding: 6px 8px" hidden></p>

        <p id="transform-over-plan" class="hint inert-panel" style="padding: 6px 8px" hidden data-i18n="generator.overPlan">
          This runs on the staged changes, not the files. The result replaces the plan, so one
          Apply and one undo still cover everything.
        </p>

        <div id="groups-menu" class="groups-list"></div>
        <div class="panel-actions" hidden>

          <div class="spacer"></div>
          <Button variant="default" size="sm" id="transform-preview" class="primary" hidden data-i18n="generator.previewChanges">Preview</Button>
        </div>
      </div>

  </div>
  </DockModule>
  </DockWorkspace>

  <div class="compact-actions" bind:this={compactActions}></div>
</main>

<input id="cover-file" type="file" accept="image/*" hidden />

<footer class="statusbar">

  <div class="sb-left">

  <Button variant="ghost" size="icon-sm" id="sb-play" class="icon" hidden data-i18n-title="player.play" title="Play the current track" data-i18n-aria-label="player.play" aria-label="Play the current track"><svg class="ico"><use href="#i-play"/></svg></Button>
  <div id="player" hidden>

    <div class="pl-transport">
      <Button variant="ghost" size="icon-sm" id="pl-prev" class="icon" data-i18n-title="player.prev" title="Previous track" data-i18n-aria-label="player.prev" aria-label="Previous track"><svg class="ico"><use href="#i-prev"/></svg></Button>
      <Button variant="ghost" size="icon-sm" id="pl-toggle" class="icon" data-i18n-title="player.toggle" title="Play / pause" data-i18n-aria-label="player.toggle" aria-label="Play / pause"><svg class="ico"><use href="#i-play"/></svg></Button>
      <Button variant="ghost" size="icon-sm" id="pl-stop" class="icon" data-i18n-title="player.stop" title="Stop" data-i18n-aria-label="player.stop" aria-label="Stop"><svg class="ico"><use href="#i-stop"/></svg></Button>
      <Button variant="ghost" size="icon-sm" id="pl-next" class="icon" data-i18n-title="player.next" title="Next track" data-i18n-aria-label="player.next" aria-label="Next track"><svg class="ico"><use href="#i-next"/></svg></Button>
      <Button variant="ghost" size="icon-sm" id="pl-repeat" class="icon" data-i18n-title="player.repeatOff" title="Repeat off" data-i18n-aria-label="player.repeatOff" aria-label="Repeat off"><svg class="ico"><use href="#i-repeat"/></svg></Button>
    </div>

    <div class="pl-vol">
      <Button variant="ghost" size="icon-sm" id="pl-volume-btn" class="icon" data-i18n-title="player.volume" title="Volume" data-i18n-aria-label="player.volume" aria-label="Volume"><svg class="ico"><use href="#i-volume"/></svg></Button>
      <div id="pl-volume-pop" class="pl-vol-pop" hidden>
        <Button variant="ghost" size="icon-sm" id="pl-mute" class="icon" data-i18n-title="player.mute" title="Mute" data-i18n-aria-label="player.mute" aria-label="Mute"><svg class="ico"><use href="#i-volume"/></svg></Button>
        <NativeSlider id="pl-volume" min="0" max="100" value="100" step="1" data-i18n-title="player.volume" title="Volume" data-i18n-aria-label="player.volume" aria-label="Volume" />
      </div>
    </div>

    <span id="pl-cover" class="pl-cover" aria-hidden="true"><img id="pl-cover-img" alt="" /></span>

    <div class="pl-main">

      <div class="pl-line">
        <Button variant="outline" size="sm" type="button" id="pl-title" class="mono" title=""></Button>
        <span id="pl-time" class="muted">0:00 / 0:00</span>
      </div>

      <span id="pl-wave-wrap" class="pl-wave-wrap">
        <canvas id="pl-wave" aria-hidden="true"></canvas>
        <NativeSlider id="pl-seek" min="0" max="1000" value="0" step="1" data-i18n-aria-label="player.seek" aria-label="Seek" />
      </span>
    </div>
  </div>
  </div>
  <div class="sb-right">

    <span id="busy-pill" class="busy-pill" hidden role="status"><span class="ab-bar"><span class="ab-bar-fill" id="busy-fill"></span></span><span id="busy-text"></span><Button variant="ghost" size="icon-sm" id="busy-stop" class="icon busy-stop" type="button" hidden data-i18n-title="action.stop" title="Stop" data-i18n-aria-label="action.stop" aria-label="Stop"><svg class="ico"><use href="#i-stop"/></svg></Button></span>
    <span id="status-transform-scope" class="muted" hidden aria-live="polite"></span>
    <span id="status-sel" class="muted"></span>
  </div>
</footer>

</Tabs.Root>

</div>
