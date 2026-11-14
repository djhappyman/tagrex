// Staged filters the normal layout to fields with actual pending changes.
// File identifies rows (including artwork-only changes); Files preferences stay intact.
export function reviewColumns(files, available, changes) {
  const changed = new Set(changes.flatMap(change => (change.tag_changes || [])
    .filter(field => field.invalid || (field.old ?? '') !== (field.new ?? ''))
    .map(field => field.field)));
  return [...new Set(['file', ...files, ...available, ...[...changed].sort()])]
    .filter(key => key === 'file' || changed.has(key));
}
