<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select/index.js';
  import ControllerTooltip from './ControllerTooltip.svelte';
  import { Toaster } from '$lib/components/ui/sonner/index.js';
  import ControllerDialog from './ControllerDialog.svelte';
  import ControllerPopover from './ControllerPopover.svelte';
  import ControllerContextMenu from './ControllerContextMenu.svelte';
  import ControllerMenuItem from './ControllerMenuItem.svelte';
  import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
</script>

    <div id="toast" class="toast" hidden role="status"><div class="toast-body"><p id="toast-title" class="toast-title"></p><ul id="toast-parts" class="toast-parts" hidden></ul></div><Button variant="ghost" size="icon-sm" id="toast-close" class="icon toast-close" type="button" hidden data-i18n-title="action.close" title="Close" data-i18n-aria-label="action.close" aria-label="Close"><svg class="ico"><use href="#i-close"/></svg></Button></div>

    <ControllerTooltip />
    <Toaster position="bottom-center" visibleToasts={1} offset="var(--controller-toast-bottom, 20px)" mobileOffset="16px" class="controller-toaster" />

    <div id="drop-overlay" aria-hidden="true">
      <div class="drop-cue">
        <div class="drop-cue-title" data-i18n="drop.title">Drop here</div>
        <div class="drop-cue-sub" data-i18n="drop.sub">A folder or files open · a single image becomes the cover</div>
      </div>
    </div>

    <ControllerContextMenu id="edit-ctx">
      <ControllerMenuItem cmd="cut"><svg class="ico"><use href="#i-cut"/></svg><span data-i18n="ctx.cut">Cut</span><span class="ctx-key" data-combo="Mod+KeyX"></span></ControllerMenuItem>
      <ControllerMenuItem cmd="copy"><svg class="ico"><use href="#i-copy"/></svg><span data-i18n="ctx.copy">Copy</span><span class="ctx-key" data-combo="Mod+KeyC"></span></ControllerMenuItem>
      <ControllerMenuItem cmd="paste"><svg class="ico"><use href="#i-paste"/></svg><span data-i18n="ctx.paste">Paste</span><span class="ctx-key" data-combo="Mod+KeyV"></span></ControllerMenuItem>
      <ContextMenu.Separator class="ctx-sep" />
      <ControllerMenuItem cmd="selectall"><svg class="ico"><use href="#i-select-all"/></svg><span data-i18n="ctx.selectAll">Select all</span><span class="ctx-key" data-combo="Mod+KeyA"></span></ControllerMenuItem>
    </ControllerContextMenu>

    <ControllerContextMenu id="file-ctx">
      <ControllerMenuItem cmd="bpm"><svg class="ico"><use href="#i-metronome"/></svg><span data-i18n="toolbar.detectBpm">Detect BPM</span><span class="ctx-key" data-action="detectBpm"></span></ControllerMenuItem>
      <ControllerMenuItem cmd="clear"><svg class="ico"><use href="#i-eraser"/></svg><span data-i18n="editor.clearTags">Clear tags</span><span class="ctx-key" data-action="clearTags"></span></ControllerMenuItem>
      <ContextMenu.Separator class="ctx-sep" />
      <ControllerMenuItem cmd="hide"><svg class="ico"><use href="#i-list-remove"/></svg><span class="ctx-label" data-i18n="ctx.removeFromList">Remove from the list</span></ControllerMenuItem>
      <ContextMenu.Separator class="ctx-sep" />
      <ControllerMenuItem cmd="trash" danger><svg class="ico"><use href="#i-trash"/></svg><span class="ctx-label" data-i18n="ctx.trash">Move to Trash…</span><span class="ctx-key" data-action="trash"></span></ControllerMenuItem>
    </ControllerContextMenu>

    <ControllerDialog id="colmask-modal" labelledby="colmask-title" closeId="colmask-close">
      <div class="modal colmask">
        <div class="modal-head">
          <h2 id="colmask-title">Add column</h2>
          <Button variant="ghost" size="icon-sm" id="colmask-close" class="icon" type="button" data-i18n-title="action.cancel" title="Cancel" data-i18n-aria-label="action.cancel" aria-label="Cancel"><svg class="ico"><use href="#i-close"/></svg></Button>
        </div>
        <div class="colmask-fields">
          <label class="colmask-row">
            <span data-i18n="colmask.name">Name</span>
            <Input id="colmask-name" type="text" spellcheck="false" data-i18n-placeholder="colmask.namePlaceholder" placeholder="Artist · Title"  />
          </label>
          <label class="colmask-row">
            <span data-i18n="colmask.pattern">Pattern</span>
            <div class="colmask-pattern field">
              <Input id="colmask-pattern" type="text" class="mono" spellcheck="false" placeholder="%artist% - %title%"  />
              <div class="field-tools">
                <Button variant="ghost" size="icon-sm" class="icon ph-btn" type="button" data-ph-target="colmask-pattern" data-i18n-title="mask.placeholders" title="Placeholders" data-i18n-aria-label="mask.placeholdersAria" aria-label="Placeholder reference"><svg class="ico"><use href="#i-help"/></svg></Button>
              </div>
            </div>
          </label>
          <div class="colmask-row">
            <span data-i18n="colmask.align">Align</span>
            <div id="colmask-align" class="seg">
              <Button variant="ghost" size="sm" type="button" class="seg-btn active" data-align="left" data-i18n="colmask.left">Left</Button>
              <Button variant="ghost" size="sm" type="button" class="seg-btn" data-align="center" data-i18n="colmask.center">Center</Button>
              <Button variant="ghost" size="sm" type="button" class="seg-btn" data-align="right" data-i18n="colmask.right">Right</Button>
            </div>
          </div>
        </div>
        <p class="settings-hint" data-i18n="colmask.hint">Read-only. The value is computed, so the cell cannot be edited. Sorting uses the displayed text, and values reflect what is on disk. Staged edits appear after Apply.</p>
        <div class="modal-actions">
          <Button variant="outline" size="sm" id="colmask-cancel" data-i18n="action.cancel">Cancel</Button>
          <Button variant="default" size="sm" id="colmask-ok" class="primary">Add column</Button>
        </div>
      </div>
    </ControllerDialog>

    <ControllerDialog id="mask-builder" labelledby="mb-title" closeId="mb-close">
      <div class="modal mask-builder">
        <div class="modal-head">
          <h2 id="mb-title">Mask builder</h2>
          <Button variant="ghost" size="icon-sm" id="mb-close" class="icon" type="button" data-i18n-title="action.cancel" title="Cancel" data-i18n-aria-label="action.cancel" aria-label="Cancel"><svg class="ico"><use href="#i-close"/></svg></Button>
        </div>
        <div class="mb-body">
          <div class="mb-main">
            <div class="field multi mb-field">
              <Textarea id="mb-expr" rows={1} spellcheck="false" autocomplete="off" data-i18n-aria-label="maskBuilder.expression" aria-label="Mask"></Textarea>
              <div class="field-tools">
                <Button variant="ghost" size="icon-sm" id="mb-clear" class="icon field-clear" type="button" data-i18n-title="maskBuilder.clear" title="Clear the mask" data-i18n-aria-label="maskBuilder.clear" aria-label="Clear the mask"><svg class="ico"><use href="#i-close"/></svg></Button>
                <span class="field-sep" aria-hidden="true"></span>
                <Button variant="ghost" size="icon-sm" class="icon preset-btn" type="button" data-preset-target="mb-expr" data-i18n-title="preset.title" title="Mask presets" data-i18n-aria-label="preset.title" aria-label="Mask presets"><svg class="ico"><use href="#i-presets"/></svg></Button>
                <Button variant="ghost" size="icon-sm" id="mb-transform" class="icon" type="button" title="Transform values" aria-label="Transform values"><svg class="ico"><use href="#i-wand"/></svg><span id="mb-rules" class="field-count"></span></Button>
              </div>
            </div>
            <div class="mb-status">
              <p id="mb-error" class="mb-error" role="alert" hidden></p>
              <p id="mb-summary" class="mb-summary" aria-live="polite"></p>
            </div>
            <div id="mb-list" class="mb-list"></div>
          </div>
          <div class="mb-ref">
            <div class="field is-empty mb-ref-search">
              <Input id="mb-ref-filter" type="search" data-i18n-placeholder="ph.filter" placeholder="Filter placeholders…" spellcheck="false" autocomplete="off"  />
              <div class="field-tools">
                <Button variant="ghost" size="icon-sm" id="mb-ref-clear" class="icon field-clear" type="button" data-i18n-title="ph.clearFilter" title="Clear the filter" data-i18n-aria-label="ph.clearFilter" aria-label="Clear the filter"><svg class="ico"><use href="#i-close"/></svg></Button>
              </div>
            </div>
            <div id="mb-ref-body" class="ph-body mb-ref-body"></div>
            <p class="ph-foot muted"><span data-i18n="ph.foot">Click one to insert it at the caret.</span><Button variant="link" size="sm" class="ph-guide" data-i18n="ph.guide">Mask guide</Button></p>
          </div>
        </div>
        <div class="modal-actions">
          <Button variant="outline" size="sm" id="mb-cancel" type="button" data-i18n="action.cancel">Cancel</Button>
          <Button variant="default" size="sm" id="mb-ok" class="primary" type="button" data-i18n="maskBuilder.ok">Use</Button>
        </div>
      </div>
    </ControllerDialog>

    <ControllerPopover id="ph-menu" class="ph-menu" label="Placeholders" labelKey="mask.placeholders">
      <div class="ph-head">
        <div class="field sm is-empty">
          <Input id="ph-filter" type="search" data-i18n-placeholder="ph.filter" placeholder="Filter placeholders…" spellcheck="false" autocomplete="off"  />
          <div class="field-tools">
            <Button variant="ghost" size="icon-sm" id="ph-filter-clear" class="icon field-clear" type="button" data-i18n-title="ph.clearFilter" title="Clear the filter" data-i18n-aria-label="ph.clearFilter" aria-label="Clear the filter"><svg class="ico"><use href="#i-close"/></svg></Button>
          </div>
        </div>
      </div>
      <div id="ph-body" class="ph-body"></div>
      <p class="ph-foot muted"><span data-i18n="ph.foot">Click one to insert it at the caret.</span><Button variant="link" size="sm" class="ph-guide" data-i18n="ph.guide">Mask guide</Button></p>
    </ControllerPopover>

    <ControllerPopover id="preset-menu" class="ph-menu preset-menu" label="Mask presets" labelKey="preset.title">
      <div class="ph-head preset-save-row">
        <Input id="preset-name" type="text" data-i18n-placeholder="preset.namePlaceholder" placeholder="Name this mask" spellcheck="false" autocomplete="off"  />
        <Button variant="outline" size="sm" id="preset-save" class="btn" type="button" data-i18n="preset.save">Save</Button>
      </div>
      <div id="preset-list" class="ph-body preset-list"></div>
      <p class="ph-foot muted" data-i18n="preset.foot">Click a preset to use it in this field.</p>
    </ControllerPopover>

    <ControllerDialog id="transform-modal" labelledby="transform-modal-title" closeId="transform-modal-close">
      <div class="modal transform-modal">
        <div class="modal-head">
          <h2 id="transform-modal-title" data-i18n="generator.transform">Transform values</h2>
          <Button variant="ghost" size="icon-sm" id="transform-modal-close" class="icon" type="button" data-i18n-title="action.done" title="Done" data-i18n-aria-label="action.done" aria-label="Done"><svg class="ico"><use href="#i-close"/></svg></Button>
        </div>
        <div id="transform-modal-body" class="transform-modal-body"></div>
      </div>
    </ControllerDialog>

    <ControllerDialog id="pe-editor" labelledby="pe-editor-title" closeId="pe-editor-close">
      <div class="modal pe-editor">
        <div class="modal-head">
          <h2 id="pe-editor-title" data-i18n="presets.title">Presets</h2>
          <Button variant="ghost" size="icon-sm" id="pe-editor-close" class="icon" type="button" data-i18n-title="action.done" title="Done" data-i18n-aria-label="action.done" aria-label="Done"><svg class="ico"><use href="#i-close"/></svg></Button>
        </div>
        <div class="pe-editor-body">
          <div class="pe-list-col">
            <div id="pe-list" class="pe-list"></div>
            <div class="pe-list-actions">
              <Button variant="outline" size="sm" id="pe-new" class="btn" type="button" data-i18n="presets.new">New</Button>
              <Button variant="outline" size="sm" id="pe-duplicate" class="btn" type="button" data-i18n="presets.duplicate">Duplicate</Button>
              <Button variant="outline" size="sm" id="pe-delete" class="btn" type="button" data-i18n="action.delete">Delete</Button>
            </div>
          </div>
          <div id="pe-edit-col" class="pe-edit-col">
            <div class="pe-name-row">
              <Input id="pe-name" type="text" spellcheck="false" data-i18n-aria-label="presets.name" aria-label="Preset name"  />
              <span id="pe-builtin-note" hidden data-i18n="presets.builtinBadge">Read only</span>
            </div>
            <fieldset id="pe-rules-set" class="pe-rules-set">
              <div id="pe-rules" class="rule-chain"></div>
              <p id="pe-empty" class="empty inert-panel rule-chain-empty" hidden data-i18n="generator.noRules" data-i18n-html>
                No rules yet. Pick a rule type and press <b>Add</b>.
              </p>
              <div class="gen-add">
                <NativeSelect id="pe-kind">
                  <NativeSelectOption value="replace" data-i18n="rule.replace">Find and replace</NativeSelectOption>
                  <NativeSelectOption value="case" data-i18n="rule.case">Change case</NativeSelectOption>
                  <NativeSelectOption value="diacritics" data-i18n="rule.diacritics">Remove diacritics</NativeSelectOption>
                  <NativeSelectOption value="transliterate" data-i18n="rule.transliterate">Transliterate to Latin</NativeSelectOption>
                  <NativeSelectOption value="untransliterate" data-i18n="rule.untransliterate">Transliterate to Cyrillic</NativeSelectOption>
                  <NativeSelectOption value="key" data-i18n="rule.key">Key notation</NativeSelectOption>
                </NativeSelect>
                <Button variant="outline" size="sm" id="pe-add" class="btn" type="button" data-i18n="generator.addRule">Add</Button>
                <div class="spacer"></div>
                <Button variant="outline" size="sm" id="pe-clear" class="btn" type="button" hidden data-i18n="generator.clearRules">Clear</Button>
              </div>
            </fieldset>
            <div class="pe-sample">
              <label class="pe-sample-row">
                <span class="pe-sample-label" data-i18n="presets.sample">Try it on</span>
                <Input id="pe-sample-input" type="text" spellcheck="false" autocomplete="off"  />
              </label>
              <div id="pe-sample-out" class="pe-sample-out" aria-live="polite"></div>
            </div>
          </div>
        </div>
      </div>
    </ControllerDialog>

    <ControllerDialog role="alertdialog" id="confirm-modal" labelledby="confirm-message" closeId="confirm-cancel" describedby="confirm-detail">
      <div class="modal confirm">
        <p id="confirm-message" class="modal-msg"></p>
        <p id="confirm-detail" class="modal-detail" hidden></p>
        <div class="modal-actions">
          <Button variant="outline" size="sm" id="confirm-cancel" data-i18n="action.cancel">Cancel</Button>
          <Button variant="default" size="sm" id="confirm-ok" class="primary" data-i18n="action.ok">OK</Button>
        </div>
      </div>
    </ControllerDialog>

