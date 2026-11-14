<script lang="ts">
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import { t, tOr } from '../js/i18n.js';
  type Field = { keys: string[]; label: string; code: string };
  const common = new Set(['title','artist','album','albumartist','track','tracktotal','disc','disctotal','year','genre']);
  let open = $state(false);
  let fields = $state.raw<Field[]>([]);
  let denied = $state<string[]>([]);
  let artwork = $state(true);
  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let more = $state(false);
  const primary = $derived(fields.filter(field => common.has(field.keys[0])));
  const secondary = $derived(fields.filter(field => !common.has(field.keys[0])));
  async function opened(value: boolean) {
    open = value;
    if (!value) return;
    loading = true; error = '';
    try {
      const { loadImportPreferences } = await import('../js/import-preferences.js');
      const result = await loadImportPreferences(true);
      fields = result.fields;
      denied = result.settings.import_skip_fields || [];
      artwork = result.settings.import_cover !== 'never';
    } catch { error = t('online.importFieldsError'); }
    finally { loading = false; }
  }
  async function persist(nextDenied: string[], nextArtwork: boolean) {
    saving = true; error = '';
    try {
      const { saveImportPreferences } = await import('../js/import-preferences.js');
      await saveImportPreferences({ import_skip_fields: nextDenied, import_cover: nextArtwork ? 'always' : 'never' });
      denied = nextDenied; artwork = nextArtwork;
    } catch { error = t('online.importFieldsError'); }
    finally { saving = false; }
  }
  function toggle(field: Field, checked: boolean) {
    const next = denied.filter(key => !field.keys.includes(key));
    if (!checked) next.push(...field.keys);
    void persist(next, artwork);
  }
  function all(checked: boolean) {
    const known = new Set(fields.flatMap(field => field.keys));
    const next = denied.filter(key => !known.has(key));
    if (!checked) next.push(...known);
    void persist(next, checked);
  }
</script>

<Popover.Root {open} onOpenChange={opened}>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button {...props} id="import-fields-trigger" variant="ghost" size="icon-sm" class="import-fields-trigger" title={t('online.importFields')} aria-label={t('online.importFields')}>
        <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12M5 2v4M11 6v4M6 10v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content id="import-fields-popover" class="import-fields-popover" align="start" sideOffset={4} collisionPadding={8} aria-label={t('online.importFields')}>
    <div class="import-fields-heading"><strong>{t('online.importFields')}</strong><span>{t('online.importFieldsRemembered')}</span></div>
    {#if loading}<p class="muted">{t('online.importFieldsLoading')}</p>
    {:else if fields.length}
      <div class="import-fields-scroll">
        <div class="import-field-choice artwork-choice">
          <Checkbox id="import-artwork-choice" checked={artwork} disabled={saving} onCheckedChange={value => persist(denied, value === true)} />
          <label for="import-artwork-choice"><span>{t('online.importArtwork')}</span><small>{t('online.importArtworkHint')}</small></label>
        </div>
        {#each primary as field (field.code)}
          <div class="import-field-choice"><Checkbox id={`online-${field.code}`} checked={!field.keys.every(key => denied.includes(key))} disabled={saving} onCheckedChange={value => toggle(field, value === true)} /><label for={`online-${field.code}`}>{tOr(field.code, field.label)}</label></div>
        {/each}
        {#if secondary.length}
          <Button variant="ghost" size="sm" class="import-fields-more" aria-expanded={more} onclick={() => more = !more}>{t('online.importFieldsMore')}<svg class="ico" aria-hidden="true"><use href={more ? '#i-caret-down' : '#i-chevron-right'} /></svg></Button>
          {#if more}{#each secondary as field (field.code)}
            <div class="import-field-choice"><Checkbox id={`online-${field.code}`} checked={!field.keys.every(key => denied.includes(key))} disabled={saving} onCheckedChange={value => toggle(field, value === true)} /><label for={`online-${field.code}`}>{tOr(field.code, field.label)}</label></div>
          {/each}{/if}
        {/if}
      </div>
      <div class="import-fields-footer"><Button variant="ghost" size="sm" disabled={saving} onclick={() => all(true)}>{t('online.importFieldsAll')}</Button><Button variant="ghost" size="sm" disabled={saving} onclick={() => all(false)}>{t('online.importFieldsClear')}</Button></div>
    {/if}
    {#if error}<p class="import-fields-error" role="alert">{error}</p>{/if}
  </Popover.Content>
</Popover.Root>
