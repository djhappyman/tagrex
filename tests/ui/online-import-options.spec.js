import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
const root=resolve('.test-dist');
test.beforeEach(async({page})=>{
  page.errors=[];page.on('pageerror',error=>page.errors.push(error.message));
  await page.route('http://tagrex.test/**',async route=>{
    const path=resolve(root,'.'+new URL(route.request().url()).pathname);if(!path.startsWith(root+sep))return route.abort();
    try{await route.fulfill({body:await readFile(path),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.woff2')?'font/woff2':'text/html'});}catch{await route.fulfill({status:404,body:'Missing fixture'});}
  });
  await page.goto('http://tagrex.test/app/ui/index.html');
  await expect.poll(()=>page.evaluate(()=>typeof window.tagrex?.openLibrary)).toBe('function');
  await page.evaluate(async()=>{document.getElementById('root').value='/music';await window.tagrex.openLibrary();window.tagrex.selection.clear();for(const track of window.tagrex.tracks)window.tagrex.selection.add(track.path);window.tagrex.renderTracks();});
});
test.afterEach(async({page})=>expect(page.errors).toEqual([]));
const popup=page=>page.locator('#import-fields-popover');
async function search(page){
  await page.locator('#discogs-token').evaluate(node=>node.value='fixture');
  await page.locator('#discogs-query').fill('La Bush');await page.locator('#discogs-search').click();
  await expect(page.locator('.release-card')).toHaveCount(5);
}
async function configure(page,keys,artwork){
  await page.evaluate(async({keys,artwork})=>{
    const fields=await window.tagrex.invoke('import_fields',{});
    const settings=await window.tagrex.invoke('load_settings',{});
    await window.tagrex.invoke('save_settings',{settings:{...settings,import_skip_fields:fields.flatMap(field=>field.keys).filter(key=>!keys.includes(key)),import_cover:artwork?'always':'never'}});
  },{keys,artwork});
}
async function importFirst(page){await page.locator('.release-card').first().locator('.release-import').click();}

for(const input of ['pointer','keyboard'])test(`collapsed artwork ${input} menu embeds without expanding or building the tracklist`,async({page})=>{
  await search(page);const card=page.locator('.release-card').first();
  const height=(await card.boundingBox()).height;
  const art=card.locator('.release-cover');
  if(input==='pointer')await art.click({button:'right'});
  else {await art.focus();await page.keyboard.press('Shift+F10');}
  const menu=card.locator('.tk-save-menu');await expect(menu).toBeVisible();
  await expect(card).toHaveAttribute('aria-expanded','false');
  await expect(card.locator('.tk-head')).toHaveCount(0);
  expect(Math.abs((await card.boundingBox()).height-height)).toBeLessThan(1);
  await menu.locator('[data-act="embed"]').click();await expect(page.locator('#diff-apply')).toBeEnabled();
  expect(await page.evaluate(()=>window.tagrex.previewPlan.changes.every(change=>change.cover_change&&!change.tag_changes.length))).toBe(true);
  await expect(card).toHaveAttribute('aria-expanded','false');
  await expect(card.locator('.tk-head')).toHaveCount(0);
  await card.locator('.release-head').click();await expect(card.locator('.tk-head')).toBeVisible();
  await expect(card.locator('.tk-save-menu')).toHaveCount(1);
});

test('uncached artwork details load without expanding the card or shifting its neighbours',async({page})=>{
  await page.evaluate(()=>{
    window.heldArtworkDetails=[];
    const original=Promise.resolve;
    Promise.resolve=function(value){
      if(value?.styles&&value?.tracks&&value?.id)return new Promise(resolve=>window.heldArtworkDetails.push({value,resolve}));
      return original.call(this,value);
    };
  });
  await search(page);const card=page.locator('.release-card').first(),next=page.locator('.release-card').nth(1);
  const id=await card.getAttribute('data-id'),before=await next.boundingBox();
  await card.locator('.release-cover').click({button:'right'});
  await expect(card.locator('.release-cover')).toHaveAttribute('aria-busy','true');
  await expect(card).toHaveAttribute('aria-expanded','false');
  await expect.poll(()=>page.evaluate(id=>window.heldArtworkDetails.filter(item=>String(item.value.id)===id).length,id)).toBeGreaterThanOrEqual(2);
  await page.evaluate(id=>{const request=window.heldArtworkDetails.filter(item=>String(item.value.id)===id).at(-1);request.resolve(request.value);},id);
  await expect(card.locator('.tk-save-menu')).toBeVisible();
  await expect(card.locator('.release-cover')).not.toHaveAttribute('aria-busy','true');
  await expect(card).toHaveAttribute('aria-expanded','false');await expect(card.locator('.tk-head')).toHaveCount(0);
  expect(Math.abs((await next.boundingBox()).y-before.y)).toBeLessThan(1);
  await page.keyboard.press('Escape');await expect(card.locator('.tk-save-menu')).toBeHidden();
  await expect(card.locator('.release-cover')).toBeFocused();
});

test('Artwork leads a compact anchored checklist; choices persist across close, source changes and imports',async({page})=>{
  await page.locator('#discogs-query').fill('Keep this query');
  const trigger=page.getByRole('button',{name:'Import fields',exact:true});await trigger.click();
  await expect(popup(page).getByRole('checkbox').first()).toHaveAttribute('id','import-artwork-choice');
  await expect(popup(page).getByRole('checkbox').first()).toBeChecked();
  const triggerBox=await trigger.boundingBox(),box=await popup(page).boundingBox();
  expect(box.width).toBeLessThanOrEqual(280);expect(Math.abs(box.x-triggerBox.x)).toBeLessThan(2);
  expect(Math.min(Math.abs(box.y-triggerBox.y-triggerBox.height-4),Math.abs(box.y+box.height-triggerBox.y+4))).toBeLessThan(2);
  await popup(page).getByText('Title',{exact:true}).click();
  await expect(popup(page).getByRole('checkbox',{name:'Title',exact:true})).not.toBeChecked();
  await expect(popup(page)).toBeVisible();
  await popup(page).getByRole('button',{name:'More fields',exact:true}).click();
  await expect(popup(page).getByText('ISRC',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(popup(page)).toHaveCount(0);await expect(trigger).toBeFocused();
  await expect(page.locator('#discogs-query')).toHaveValue('Keep this query');
  await search(page);await importFirst(page);await expect(page.locator('#diff-apply')).toBeEnabled();
  expect(await page.evaluate(()=>window.tagrex.previewPlan.changes.some(change=>change.tag_changes.some(field=>field.field==='title')))).toBe(false);
  await page.locator('#online-source').selectOption('musicbrainz',{force:true});
  await trigger.click();await expect(popup(page).getByRole('checkbox',{name:'Title',exact:true})).not.toBeChecked();
  await popup(page).getByRole('button',{name:'Clear all',exact:true}).click();
  await expect(popup(page).getByRole('checkbox').first()).not.toBeChecked();
  await popup(page).getByRole('button',{name:'Select all',exact:true}).click();
  await expect(popup(page).getByRole('checkbox').first()).toBeChecked();
});

test('Staged omits unchanged files when importing tags only',async({page})=>{
  await configure(page,['title'],false);await search(page);await importFirst(page);
  await expect(page.locator('#diff-apply')).toBeEnabled();await page.locator('#staged-tab').click();
  await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(1);
  expect(await page.locator('#tracks thead th[data-sort]').evaluateAll(nodes=>nodes.map(node=>node.dataset.sort))).toEqual(['artwork','file','title']);
  const plan=await page.evaluate(()=>window.tagrex.previewPlan);
  expect(plan.changes).toHaveLength(1);expect(plan.changes[0].tag_changes.map(field=>field.field)).toEqual(['title']);
  expect(plan.changes[0].cover_change).toBeNull();
  await expect(page.locator('.track-artwork.artwork-changing')).toHaveCount(0);
});

test('artwork-only imports show change markers; repeating identical saved artwork stages nothing',async({page})=>{
  await configure(page,[],true);await search(page);await importFirst(page);await expect(page.locator('#diff-apply')).toBeEnabled();
  await page.locator('#staged-tab').click();await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(3);
  expect(await page.locator('#tracks thead th[data-sort]').evaluateAll(nodes=>nodes.map(node=>node.dataset.sort))).toEqual(['artwork','file']);
  await expect(page.getByRole('img',{name:'Artwork will be replaced',exact:true})).toHaveCount(1);
  await expect(page.getByRole('img',{name:'Artwork will be added',exact:true})).toHaveCount(2);
  expect(await page.evaluate(()=>window.tagrex.previewPlan.changes.every(change=>change.tag_changes.length===0&&change.cover_change))).toBe(true);
  await page.locator('#diff-apply').click();await expect(page.locator('#diff-apply')).toBeHidden();
  await page.evaluate(()=>{for(const track of window.tagrex.tracks)window.tagrex.selection.add(track.path);window.tagrex.renderTracks();});
  await importFirst(page);await expect.poll(()=>page.evaluate(()=>window.tagrex.previewPlan?.changes.length||0)).toBe(0);
  await expect(page.locator('#staged-tab-count')).toHaveText('');
});

for(const theme of ['light','dark'])test(`release card and import popup fit a narrow inspector in ${theme}`,async({page},testInfo)=>{
  await page.setViewportSize({width:980,height:740});await page.emulateMedia({colorScheme:theme});
  await search(page);const card=page.locator('.release-card').first();
  await expect(card.locator('.release-import')).toBeVisible();await expect(card.locator('.release-import')).toHaveText('Import');
  const header=await card.locator('.release-header-row').boundingBox(),action=await card.locator('.release-import').boundingBox();
  expect(action.y+action.height).toBeLessThanOrEqual(header.y+header.height);
  expect(action.x+action.width).toBeGreaterThan(header.x+header.width-8);
  const roles=await card.evaluate(node=>['.release-title','.release-artist','.release-meta','.release-import'].map(selector=>{const style=getComputedStyle(node.querySelector(selector));return{size:parseFloat(style.fontSize),weight:Number(style.fontWeight)};}));
  expect(roles[0].size).toBeGreaterThan(roles[1].size);expect(roles[1].size).toBeGreaterThan(roles[2].size);
  expect(roles[0].weight).toBe(600);expect(roles[1].weight).toBe(400);expect(roles[2].weight).toBe(400);expect(roles[3].weight).toBe(500);
  await card.screenshot({path:testInfo.outputPath('compact-release-card.png'),animations:'disabled'});
  await page.locator('#import-fields-trigger').click();await expect(popup(page).getByRole('checkbox').first()).toBeVisible();
  const bounds=await popup(page).boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(8);expect(bounds.x+bounds.width).toBeLessThanOrEqual(972);
  await page.keyboard.press('Escape');await card.locator('.release-head').click();await expect(card.locator('.tk-head')).toBeVisible();
});

test('label selection lives inside the compact card and survives expansion before import',async({page})=>{
  await configure(page,['catalognumber'],false);await search(page);
  const card=page.locator('.release-card').first(),picker=card.locator('.label-picker');
  await expect(picker).toHaveCount(1);await picker.selectOption('1',{force:true});
  await card.locator('.release-head').click();await expect(card.locator('.tk-head')).toBeVisible();
  await expect(picker).toHaveValue('1');await expect(card.locator('.tracklist-label')).toHaveCount(0);
  await expect(card.locator('.tk-count')).toContainText('3 tracks');
  await card.locator('.release-import').click();await expect(page.locator('#diff-apply')).toBeEnabled();
  expect(await page.evaluate(()=>window.tagrex.previewPlan.changes.every(change=>change.tag_changes.find(field=>field.field==='catalognumber')?.new==='7243 8 52174 2 5'))).toBe(true);
});

test('a single label is quiet text in the footer, without a dropdown or repeated catalogue line',async({page})=>{
  await page.evaluate(()=>{const original=Promise.resolve;Promise.resolve=function(value){if(value?.styles&&value?.tracks&&value?.id)value={...value,labels:value.labels.slice(0,1)};return original.call(this,value);};});
  await search(page);const card=page.locator('.release-card').first();
  await expect(card.locator('.release-label-link')).toContainText('Antler-Subway');
  await expect(card.locator('.release-label-link .rb-catno')).toHaveText('AS 5606');
  await expect(card.locator('.label-picker,.release-facts,.release-card-actions')).toHaveCount(0);
  await expect(card.locator('.tk-count')).toHaveCount(0);
});

test('long release names and label choices keep their type sizes and leave Import reachable',async({page},testInfo)=>{
  await page.setViewportSize({width:980,height:740});
  await page.evaluate(()=>{
    const original=Promise.resolve;
    Promise.resolve=function(value){
      if(Array.isArray(value)&&value[0]?.catalog_number&&value[0]?.thumb_url!==undefined){value[0].title='Hardcore Til I Die — The Complete Anniversary Collection With Extended Original Mixes';value[0].artist='Re-Con, Squad-E, Hixxy, Styles & Breeze';}
      if(value?.styles&&value?.tracks&&value?.id)value={...value,labels:value.labels.map(label=>({...label,name:'Universal Music Television — International Anniversary Edition Label'}))};
      return original.call(this,value);
    };
  });
  await search(page);const card=page.locator('.release-card').first();
  await expect(card.locator('.label-picker')).toHaveCount(1);
  const cardBox=await card.boundingBox();
  for(const selector of ['.release-title','.release-label','.release-import']){
    const box=await card.locator(selector).boundingBox();expect(box.x).toBeGreaterThanOrEqual(cardBox.x);expect(box.x+box.width).toBeLessThanOrEqual(cardBox.x+cardBox.width+1);
  }
  const title=await card.locator('.release-title').evaluate(node=>({height:node.getBoundingClientRect().height,line:parseFloat(getComputedStyle(node).lineHeight),size:parseFloat(getComputedStyle(node).fontSize)}));
  expect(title.height).toBeLessThanOrEqual(title.line*2+1);expect(title.size).toBe(13);
  await card.screenshot({path:testInfo.outputPath('long-release-card.png'),animations:'disabled'});
});

async function importWrongYear(page,extra=[]){
  await page.evaluate(()=>{
    for(const track of window.tagrex.tracks)track.tags.year='2003';
    const original=Promise.resolve;
    Promise.resolve=function(value){if(value?.styles&&value?.tracks&&value?.id)value={...value,year:2004};return original.call(this,value);};
  });
  await configure(page,['year',...extra],false);await search(page);await importFirst(page);await expect(page.locator('#diff-apply')).toBeEnabled();
  await page.locator('#staged-tab').click();
  await page.locator('.subtab[data-subtab="editor"]').click();
  await page.locator('#fields-body [data-key="year"]').fill('2003');
  await expect.poll(()=>page.evaluate(()=>window.tagrex.previewPlan?.changes.some(change=>change.tag_changes.some(field=>field.field==='year'))||false)).toBe(false);
}
test('Staged exposes hidden import fields after reverting the year and preserves Files columns',async({page})=>{
  const original=await page.locator('#tracks thead th[data-sort]').evaluateAll(nodes=>nodes.map(node=>node.dataset.sort));
  await importWrongYear(page,['catalognumber']);
  await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(3);
  await expect(page.locator('#tracks th[data-sort="catalognumber"]')).toHaveCount(1);
  await expect(page.locator('#tracks th[data-sort="publisher"]')).toHaveCount(0);
  const row=page.locator('#tracks-body tr[data-path]').first();
  await expect(row.locator('td[data-field="catalognumber"]')).toHaveClass(/dirty/);
  await expect(row.locator('td[data-field="catalognumber"]')).toHaveText('AS 5606');
  await expect(page.locator('#tracks th[data-sort="year"]')).toHaveCount(0);
  const staged=await page.locator('#tracks thead th[data-sort]').evaluateAll(nodes=>nodes.map(node=>node.dataset.sort));
  expect(staged).toEqual(['artwork','file','catalognumber']);
  expect(await page.locator('#tracks thead').textContent()).not.toContain('custom:');
  expect(await row.locator(':scope > td').count()).toBe(await page.locator('#tracks thead tr > th').count());
  await page.locator('#files-tab').click();
  expect(await page.locator('#tracks thead th[data-sort]').evaluateAll(nodes=>nodes.map(node=>node.dataset.sort))).toEqual(original);
  await page.locator('#staged-tab').click();
  expect(await page.locator('#tracks thead th[data-sort]').evaluateAll(nodes=>nodes.map(node=>node.dataset.sort))).toEqual(staged);
});
test('reverting the only imported field removes every file from Staged',async({page})=>{
  await importWrongYear(page);
  await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(0);
  await expect(page.locator('#staged-tab-count')).toHaveText('');
  await expect(page.locator('#diff-apply')).toBeHidden();
});

test('reverting the last changed cell in a column keeps its editor until blur, then removes that column',async({page})=>{
  await page.evaluate(()=>{
    const first=window.tagrex.tracks[0];first.tags.year='2003';
    window.tagrex.selection.clear();window.tagrex.selection.add(first.path);window.tagrex.renderTracks();
  });
  await page.locator('.subtab[data-subtab="editor"]').click();
  await page.locator('#fields-body [data-key="title"]').fill('Keep this title change');
  await page.locator('#fields-body [data-key="year"]').fill('2004');
  await expect(page.locator('#diff-apply')).toBeEnabled();
  await page.locator('#staged-tab').click();
  const cell=page.locator('#tracks-body tr[data-path] td[data-field="year"]').first();
  await cell.dblclick();await page.keyboard.press('Control+a');
  await cell.evaluate(node=>window.reviewEditingCell=node);
  await page.keyboard.type('2003');
  await expect.poll(()=>page.evaluate(()=>window.tagrex.previewPlan?.changes.every(change=>change.tag_changes.every(field=>field.field!=='year')))).toBe(true);
  expect(await page.evaluate(()=>window.reviewEditingCell.isConnected&&document.activeElement===window.reviewEditingCell)).toBe(true);
  await expect(page.locator('#tracks th[data-sort="year"]')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.locator('#tracks th[data-sort="year"]')).toHaveCount(0);
  await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(1);
  await expect(page.locator('#tracks-body td[data-field="title"]')).toContainText('Keep this title change');
});

test('changed provider metadata uses readable headings and remains in catalogue order',async({page},testInfo)=>{
  await configure(page,['catalognumber','custom:DISCOGS_RELEASE_ID','custom:POSITION'],false);
  await search(page);await importFirst(page);await expect(page.locator('#diff-apply')).toBeEnabled();
  await page.locator('#staged-tab').click();
  await expect(page.locator('#tracks th[data-sort="custom:DISCOGS_RELEASE_ID"]')).toContainText('Discogs Release ID');
  await expect(page.locator('#tracks th[data-sort="custom:POSITION"]')).toContainText('Track Position');
  expect(await page.locator('#tracks thead').textContent()).not.toContain('custom:');
  expect(await page.locator('#tracks thead th[data-sort]').evaluateAll(nodes=>nodes.map(node=>node.dataset.sort))).toEqual(['artwork','file','catalognumber','custom:DISCOGS_RELEASE_ID','custom:POSITION']);
  await page.screenshot({path:testInfo.outputPath('staged-columns.png')});
});
