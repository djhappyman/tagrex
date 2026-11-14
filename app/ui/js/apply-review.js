// Presentation only: disk/readback and Undo retain ownership of track metadata.
// Keep rows/cells attached, including the old-value lines that set row height.
export function createApplyReview(changes, { columns, offset, rowForPath, artworkLabel }) {
  const states = new Map(changes.map(change => [change.path, { change, tags: false, transfer: false }]));
  const originals = new WeakMap();
  let current = null;
  function remember(node) {
    if (!originals.has(node)) originals.set(node, {
      className: node.className, title: node.getAttribute('title'),
      selected: node.getAttribute('aria-selected'), disabled: node.getAttribute('aria-disabled'),
      text: [...node.childNodes].filter(child => child.nodeType === 3).map(child => [child, child.nodeValue]),
      visibility: node.style.visibility,
      coverState: node.getAttribute('data-cover-state'), label: node.getAttribute('aria-label'),
    });
  }
  function text(node, value) {
    remember(node);
    let leaf = [...node.childNodes].find(child => child.nodeType === 3);
    if (!leaf) { leaf = document.createTextNode(''); node.prepend(leaf); originals.get(node).inserted = leaf; }
    const next = String(value ?? '');
    if (leaf.nodeValue !== next) leaf.nodeValue = next;
  }
  function paint(row) {
    const state = states.get(row?.dataset.path);
    if (!state) return;
    const { change, tags, transfer } = state;
    const writesTags = change.tag_changes?.length || change.cover_change || change.block_changes?.length;
    const complete = (!writesTags || tags) && (!change.rename_to || transfer);
    remember(row);
    row.dataset.applyState = complete ? 'complete' : 'pending';
    row.classList.toggle('applying-current', row.dataset.path === current && !complete);
    row.classList.toggle('apply-complete', complete);
    row.classList.toggle('selected', !complete && originals.get(row).className.split(' ').includes('selected'));
    if (complete) { row.setAttribute('aria-selected', 'false'); row.setAttribute('aria-disabled', 'true'); }
    for (const [index, key] of columns.entries()) {
      const cell = row.cells[offset + index];
      if (!cell) continue;
      const field = change.tag_changes?.find(field => field.field === key);
      if (field) {
        text(cell, tags ? field.new : field.old);
        cell.classList.toggle('dirty', !tags);
        cell.classList.remove('cleared');
      }
      if (key === 'file' && change.rename_to) {
        text(cell.querySelector('.fname') || cell, (transfer ? change.rename_to : change.path).split(/[\\/]/).pop());
        const folder = cell.querySelector('.fpath');
        if (folder) {
          const path = transfer ? change.rename_to : change.path;
          text(folder, path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))) + '/');
        }
        remember(cell); cell.title = transfer ? change.rename_to : change.path;
        cell.classList.toggle('dirty', !transfer);
      }
      if (field || key === 'file' && change.rename_to) for (const old of cell.querySelectorAll('.cell-old')) {
        remember(old); old.style.visibility = 'hidden';
      }
    }
    const art = row.querySelector('.track-artwork');
    if (art && change.cover_change) {
      remember(art);
      const pictures = tags ? change.cover_change.new : change.cover_change.old;
      art.dataset.coverState = pictures?.length ? 'embedded' : 'missing';
      art.classList.toggle('artwork-changing', !tags);
      art.title = artworkLabel(art.dataset.coverState);
      art.setAttribute('aria-label', art.title);
    }
  }
  function progress(event) {
    const state = states.get(event.path);
    if (!state) return;
    if (event.completed === 'tags') state.tags = true;
    else if (event.completed === 'transfer') state.transfer = true;
    else {
      const previous = current; current = event.path;
      if (previous !== current) paint(rowForPath(previous));
    }
    paint(rowForPath(event.path));
  }
  function restore() {
    for (const path of states.keys()) {
      const row = rowForPath(path);
      if (!row) continue;
      for (const node of [row, ...row.querySelectorAll('td,.fname,.fpath,.cell-old,.track-artwork')]) {
        const saved = originals.get(node);
        if (!saved) continue;
        node.className = saved.className;
        for (const [key, value] of [['title',saved.title],['aria-selected',saved.selected],['aria-disabled',saved.disabled],['data-cover-state',saved.coverState],['aria-label',saved.label]]) {
          if (value === null) node.removeAttribute(key); else node.setAttribute(key, value);
        }
        node.style.visibility = saved.visibility;
        for (const [leaf, value] of saved.text) leaf.nodeValue = value;
        saved.inserted?.remove();
        delete node.dataset.applyState;
      }
    }
  }
  function completeAll() {
    for (const state of states.values()) { state.tags = true; state.transfer = true; paint(rowForPath(state.change.path)); }
  }
  return { paint, progress, restore, completeAll };
}
