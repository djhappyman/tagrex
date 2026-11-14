import { invoke } from './invoke.js';
import { savedSettings, setSavedSettings } from './state.js';

let loaded = false;
let loading;
let saving = Promise.resolve();
let fields;
export async function loadImportPreferences(refresh = false) {
  await saving;
  if (!loaded || refresh) {
    loading ||= invoke('load_settings', {}).then(settings => {
      setSavedSettings(settings); loaded = true;
    }).finally(() => { loading = null; });
    await loading;
  }
  fields ||= await invoke('import_fields', {});
  return { fields, settings: /** @type {Record<string, any>} */ (savedSettings) };
}
export function saveImportPreferences(preferences) {
  const operation = saving.then(async () => {
    const settings = { ...savedSettings, ...preferences };
    await invoke('save_settings', { settings });
    setSavedSettings(settings);
    document.dispatchEvent(new CustomEvent('tagrex:import-preferences'));
  });
  saving = operation.catch(() => {});
  return operation;
}
export async function prepareImportPreferences() {
  const result = await loadImportPreferences();
  // The inline artwork choice is explicit: checked replaces the main cover.
  // Older profiles used a three-way policy; migrate its enabled state once.
  if (result.settings.import_cover !== 'never' && result.settings.import_cover !== 'always') {
    await saveImportPreferences({ import_cover: 'always' });
  }
  return savedSettings;
}
