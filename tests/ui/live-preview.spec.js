import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const fixture = resolve('.test-dist');
const preset = {name:'Append once',scope:'title',rules:[{kind:'replace',scope:'title',from:'$',to:'!',regex:true,style:''}]};

test.beforeEach(async({page})=>{
  page.__liveErrors=[]; page.on('pageerror',error=>page.__liveErrors.push(error.message));
  await page.addInitScript(group=>{
    localStorage.setItem('tagrex.activePresetsByJob',JSON.stringify({generator:[],online:[],fromname:[],renamer:[]}));
    window.liveCalls={}; window.liveHeldImports=[];
    const original=Promise.resolve;
    Promise.resolve=function(value){
      if(value&&typeof value==='object'&&'proxy' in value&&'portable_names' in value) value={...value,action_groups:[group]};
      if(value?.styles&&value?.tracks&&value?.id){
        value=structuredClone(value); value.title=`Release ${value.id}`;
        if(window.liveExtendedSource)value.tracks=Array.from({length:6},(_,index)=>({...value.tracks[index%value.tracks.length],position:String(index+1)}));
        value.tracks.forEach((track,index)=>{track.title=`${value.id} track ${index+1}`;});
      }
      if(window.liveNativeInvalid && value?.changes?.some(change=>change.tag_changes?.some(field=>field.field==='bpm'&&field.new==='123.5'))){
        value=structuredClone(value);
        for(const change of value.changes)for(const field of change.tag_changes||[])if(field.field==='bpm'&&field.new==='123.5')field.invalid=true;
      }
      if(window.liveHoldImports && value?.description?.startsWith('Import') && value?.changes)return new Promise(resolve=>window.liveHeldImports.push({value,resolve}));
      if(window.liveNativeCoverInvalid && value?.changes?.some(change=>change.cover_change)){value=structuredClone(value);for(const change of value.changes)if(change.cover_change)change.cover_change.invalid=true;}
      if(window.liveDelayApply && value?.id && value?.description && 'applied_at' in value)return new Promise(resolve=>setTimeout(()=>resolve(value),900));
      return original.call(this,value);
    };
  },preset);
  await page.route('http://tagrex.test/**',async route=>{
    const path=resolve(fixture,'.'+new URL(route.request().url()).pathname);
    if(!path.startsWith(fixture+sep))return route.abort();
    try{
      let body=await readFile(path);
      if(path.endsWith('.js'))body=Buffer.from(body.toString()
        .replace(/case([`"'])apply_plan\1:\s*for\((?:let|const)\s+\w+\s+of\s+(\w+)\.plan\.changes\)/g,(match,_quote,args)=>match.replace(':',`:window.liveAppliedPaths=${args}.plan.changes.map(change=>change.path);`))
        .replace(/case([`"'])(preview_live_edits|preview_import|apply_plan|undo)\1:/g,(match,_quote,command)=>`${match}window.liveCalls['${command}']=(window.liveCalls['${command}']||0)+1;`));
      await route.fulfill({body,contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.woff2')?'font/woff2':'text/html'});
    }catch(error){if(!String(error).includes('ENOENT'))throw error;await route.fulfill({status:404,body:'Missing fixture'});}
  });
  await page.goto('http://tagrex.test/app/ui/index.html');
  await expect.poll(()=>page.evaluate(()=>typeof window.tagrex?.openLibrary)).toBe('function');
  await page.locator('#root-display').click();await page.locator('#root').fill('/music');await page.locator('#root').press('Enter');
  await expect(page.locator('#tracks-body tr[data-path]')).toHaveCount(3);
  await page.locator('.subtab[data-subtab="editor"]').click();
});
test.afterEach(async({page})=>expect(page.__liveErrors).toEqual([]));
const field=(page,key)=>page.locator(`#fields-body [data-key="${key}"]`);
const calls=(page,key)=>page.evaluate(key=>window.liveCalls[key]||0,key);
const plan=page=>page.evaluate(()=>window.tagrex.previewPlan);
const titleOf=(value,path)=>value?.changes.find(change=>change.path===path)?.tag_changes.find(change=>change.field==='title')?.new;
const selected=page=>page.evaluate(()=>window.tagrex.selectedPaths()[0]);
async function ready(page){await expect(page.locator('#diff-apply')).toBeVisible();await expect(page.locator('#diff-apply')).toBeEnabled();}
async function tick(page,on=true){
  const row=page.locator('#groups-menu .preset-check').filter({has:page.locator('.preset-apply',{hasText:'Append once'})});
  if(await row.locator('input.group-tick').isChecked()!==on)await row.locator('.preset-apply').click();
}
async function releases(page){
  await page.locator('.subtab[data-subtab="online"]').click();
  await page.evaluate(()=>document.getElementById('discogs-token').value='fixture');
  await page.locator('#discogs-query').fill('La Bush');await page.locator('#discogs-search').click();
  await expect(page.locator('.release-card')).toHaveCount(5);
  for(const card of await page.locator('.release-card').all()){
    if(await card.getAttribute('aria-expanded')!=='true')await card.locator('.release-head').click();
    await expect(card).toHaveClass(/tracklist-loaded/);
  }
}

test('typing previews the selected track immediately without Stage or any disk write',async({page})=>{
  await expect(page.locator('#fields-apply')).toHaveCount(0);
  const path=await selected(page);
  const instant=await field(page,'title').evaluate(node=>{node.value='Immediate title';node.dispatchEvent(new InputEvent('input',{bubbles:true}));const index=[...document.querySelectorAll('#tracks thead th')].findIndex(node=>node.dataset.sort==='title');return document.querySelector('#tracks-body tr[data-path]').cells[index].textContent;});
  expect(instant).toContain('Immediate title');
  await ready(page);expect(titleOf(await plan(page),path)).toBe('Immediate title');
  expect(await calls(page,'preview_live_edits')).toBeGreaterThan(0);
  expect(await calls(page,'apply_plan')).toBe(0);
  expect(await page.evaluate(()=>window.tagrex.tracks.find(track=>track.path===window.tagrex.selectedPaths()[0]).tags.title)).toBe('Desert Rain');
});

test('transformations run after raw Editor values once and toggling never compounds output',async({page})=>{
  const path=await selected(page);await tick(page);await ready(page);
  await field(page,'title').fill('Manual');await ready(page);
  await expect.poll(async()=>titleOf(await plan(page),path)).toBe('Manual!');
  await expect(field(page,'title')).toHaveValue('Manual');
  await tick(page,false);await ready(page);await expect.poll(async()=>titleOf(await plan(page),path)).toBe('Manual');
  await tick(page,true);await ready(page);await expect.poll(async()=>titleOf(await plan(page),path)).toBe('Manual!');
  expect(await calls(page,'apply_plan')).toBe(0);
});

test('invalid input blocks the entire pending Apply until corrected',async({page})=>{
  await field(page,'title').fill('Valid pending title');await ready(page);
  await field(page,'year').fill('123');
  await expect(field(page,'year')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#diff-apply')).toBeDisabled();
  expect(await calls(page,'apply_plan')).toBe(0);
  await field(page,'year').fill('2001');await ready(page);
  await page.locator('#diff-apply').click();
  await expect.poll(()=>calls(page,'apply_plan')).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.tagrex.tracks[0].tags.title)).toBe('Valid pending title');
});

test('pending edits stay with original tracks across selection changes and Apply as one batch',async({page})=>{
  const first=await selected(page);await field(page,'title').fill('Track A edit');await ready(page);
  await page.locator('#tracks-body tr[data-path] td.file').nth(1).click();
  const second=await selected(page);expect(second).not.toBe(first);
  await field(page,'title').fill('Track B edit');await ready(page);
  await expect.poll(async()=>titleOf(await plan(page),first)).toBe('Track A edit');
  expect(titleOf(await plan(page),second)).toBe('Track B edit');
  await page.locator('#diff-apply').click();await expect.poll(()=>calls(page,'apply_plan')).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.tagrex.tracks.slice(0,2).map(track=>track.tags.title))).toEqual(['Track A edit','Track B edit']);
});

test('Discard clears pending raw inputs without immediately regenerating the dismissed transform',async({page})=>{
  await tick(page);await field(page,'title').fill('Discard me');await ready(page);
  await page.locator('#diff-discard').click();
  await expect(field(page,'title')).toHaveValue('Desert Rain');
  await page.waitForTimeout(180);
  expect(await plan(page)).toBeNull();expect(await calls(page,'apply_plan')).toBe(0);
});

test('choosing another release replaces its import preview and applies active transformations afterward',async({page})=>{
  const path=await selected(page);await tick(page);await releases(page);
  const cards=page.locator('.release-card');
  const a=await cards.nth(0).getAttribute('data-id'),b=await cards.nth(1).getAttribute('data-id');
  await cards.nth(0).locator('.release-import').click();await ready(page);
  await expect.poll(async()=>titleOf(await plan(page),path)).toBe(`${a} track 1!`);
  await cards.nth(1).locator('.release-import').click();await ready(page);
  await expect.poll(async()=>titleOf(await plan(page),path)).toBe(`${b} track 1!`);
  const album=(await plan(page)).changes.find(change=>change.path===path).tag_changes.find(change=>change.field==='album');
  expect(album.new).toBe(`Release ${b}`);expect(await calls(page,'apply_plan')).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async()=>titleOf(await plan(page),path)).toBe(`${a} track 1!`);
  expect(await calls(page,'undo')).toBe(0);
});


test('backend-invalid fields cannot partly Apply otherwise-valid pending values',async({page})=>{
  await field(page,'title').fill('Keep atomic');await ready(page);
  await page.evaluate(()=>window.liveNativeInvalid=true);
  await field(page,'bpm').fill('123.5');
  await expect.poll(async()=>!!(await plan(page))?.changes.some(change=>change.tag_changes.some(field=>field.invalid))).toBe(true);
  await expect(page.locator('#diff-apply')).toBeDisabled();
  await page.locator('#diff-apply').dispatchEvent('click');
  expect(await calls(page,'apply_plan')).toBe(0);
  expect(await page.evaluate(()=>window.tagrex.tracks[0].tags.title)).toBe('Desert Rain');
  await field(page,'bpm').fill('124');await ready(page);
  await page.locator('#diff-apply').click();await expect.poll(()=>calls(page,'apply_plan')).toBe(1);
});


test('typing multiple characters in a spreadsheet cell retains its raw editing node and waits for Apply',async({page})=>{
  const cell=page.locator('#tracks-body tr[data-path] td[data-field="title"]').first();
  await cell.dblclick();await page.keyboard.press('Control+a');
  await cell.evaluate(node=>window.liveEditingCell=node);
  await page.keyboard.type('Continuous typing',{delay:15});
  expect(await page.evaluate(()=>window.liveEditingCell.isConnected&&document.activeElement===window.liveEditingCell)).toBe(true);
  expect(await page.evaluate(()=>window.liveEditingCell.textContent)).toBe('Continuous typing');
  expect(await calls(page,'apply_plan')).toBe(0);
  await page.keyboard.press('Enter');await ready(page);
  expect(titleOf(await plan(page),await selected(page))).toBe('Continuous typing');
});

test('importing a different selected track retains the previous track’s pending import',async({page})=>{
  const first=await selected(page);await tick(page);await releases(page);
  const cards=page.locator('.release-card');
  const a=await cards.nth(0).getAttribute('data-id'),b=await cards.nth(1).getAttribute('data-id');
  await cards.nth(0).locator('.release-import').click();await ready(page);
  await expect.poll(async()=>titleOf(await plan(page),first)).toBe(`${a} track 1!`);
  await page.locator('#tracks-body tr[data-path] td.file').nth(1).click();
  const second=await selected(page);expect(second).not.toBe(first);
  await cards.nth(1).locator('.release-import').click();await ready(page);
  await expect.poll(async()=>titleOf(await plan(page),second)).toBe(`${b} track 1!`);
  expect(titleOf(await plan(page),first)).toBe(`${a} track 1!`);
  expect(await calls(page,'apply_plan')).toBe(0);
});


test('compact Apply freezes mutation inputs while leaving Cancel reachable',async({page})=>{
  await page.setViewportSize({width:375,height:750});
  await page.getByRole('tab',{name:'Inspector',exact:true}).click();
  await field(page,'title').fill('Safe pending edit');await ready(page);
  await expect(page.locator('#diff-apply')).toBeInViewport({ratio:1});
  await page.evaluate(()=>window.liveDelayApply=true);
  await page.locator('#diff-apply').click();
  await expect(page.locator('#mode-col')).toHaveAttribute('inert','');
  await expect(page.locator('#files-view')).not.toHaveAttribute('inert',''); // scrolling remains available
  await expect(page.locator('#diff-cancel-apply')).toBeInViewport({ratio:1});
  await expect(page.locator('#diff-cancel-apply')).toBeEnabled();
  await expect.poll(()=>page.locator('#mode-col').evaluate(node=>node.inert)).toBe(false);
});

test('manual cover removal composes with pending Editor values and transformations in one Apply',async({page})=>{
  const path=await selected(page);await tick(page);
  await field(page,'title').fill('Tags and cover');await ready(page);
  await page.locator('#cover-well .cover-edit').scrollIntoViewIfNeeded();
  await page.locator('#cover-well .cover-edit').click();
  await page.getByRole('menuitem',{name:'Remove',exact:true}).click();
  await expect.poll(async()=>!!(await plan(page))?.changes.find(change=>change.path===path)?.cover_change).toBe(true);
  await ready(page);
  expect(titleOf(await plan(page),path)).toBe('Tags and cover!');
  expect((await plan(page)).changes.find(change=>change.path===path).cover_change.new).toEqual([]);
  await expect(page.locator('#tracks-body tr[data-path]').first().locator('.track-artwork')).toHaveAttribute('data-cover-state','missing');
  await field(page,'title').fill('Still one plan');await ready(page);
  expect((await plan(page)).changes.find(change=>change.path===path).cover_change.new).toEqual([]);
  await expect(page.locator('#tracks-body tr[data-path]').first().locator('.track-artwork')).toHaveAttribute('data-cover-state','missing');
  expect(await calls(page,'apply_plan')).toBe(0);
  await page.locator('#diff-apply').click();await expect.poll(()=>calls(page,'apply_plan')).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.tagrex.tracks[0].tags.title)).toBe('Still one plan!');
});


test('rapid release choices keep one active import and only the newest waiting choice',async({page})=>{
  const path=await selected(page);await tick(page);await ready(page);await releases(page);
  await page.evaluate(()=>window.liveHoldImports=true);
  const cards=page.locator('.release-card');const newest=await cards.nth(2).getAttribute('data-id');
  await cards.nth(0).locator('.release-import').click();
  await expect.poll(()=>page.evaluate(()=>window.liveHeldImports.length)).toBe(1);
  await expect(page.locator('#diff-apply')).toBeDisabled();
  await cards.nth(1).locator('.release-import').click();await cards.nth(2).locator('.release-import').click();
  expect(await calls(page,'preview_import')).toBe(1);
  await page.evaluate(()=>window.liveHeldImports[0].resolve(window.liveHeldImports[0].value));
  await expect.poll(()=>page.evaluate(()=>window.liveHeldImports.length)).toBe(2);
  expect(await calls(page,'preview_import')).toBe(2);
  await page.evaluate(()=>window.liveHeldImports[1].resolve(window.liveHeldImports[1].value));
  await ready(page);await expect.poll(async()=>titleOf(await plan(page),path)).toBe(`${newest} track 1!`);
  expect(await calls(page,'apply_plan')).toBe(0);
});

test('a rejected artwork proposal blocks the entire Apply and pending artwork is identified clearly',async({page})=>{
  await field(page,'title').fill('Do not partly write');await ready(page);
  await page.evaluate(()=>window.liveNativeCoverInvalid=true);
  await page.locator('#cover-well .cover-edit').scrollIntoViewIfNeeded();await page.locator('#cover-well .cover-edit').click();
  await page.getByRole('menuitem',{name:'Remove',exact:true}).click();
  await expect.poll(async()=>!!(await plan(page))?.changes.some(change=>change.cover_change?.invalid)).toBe(true);
  await expect(page.locator('#diff-apply')).toBeDisabled();await page.locator('#diff-apply').dispatchEvent('click');
  expect(await calls(page,'apply_plan')).toBe(0);
  await expect(page.locator('.cover-empty-target')).toBeVisible();
  await page.locator('#cover-well .cover-edit').click();
  await expect(page.getByRole('menuitem',{name:'Export saved cover',exact:true})).toBeEnabled();
});


test('copying a live cell copies the displayed transformed preview without saving',async({page})=>{
  await tick(page);await field(page,'title').fill('Copy this');await ready(page);
  await expect.poll(async()=>titleOf(await plan(page),await selected(page))).toBe('Copy this!');
  await page.locator('#tracks-body tr[data-path] td[data-field="title"]').first().click();
  const text=await page.evaluate(()=>{const data=new DataTransfer();document.activeElement.dispatchEvent(new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:data}));return data.getData('text/plain');});
  expect(text).toBe('Copy this!');expect(await calls(page,'apply_plan')).toBe(0);
});


test('embedding release artwork keeps pending tags and active transformations in one preview',async({page})=>{
  const path=await selected(page);await tick(page);await field(page,'title').fill('Keep these tags');await ready(page);await releases(page);
  await page.locator('.release-card').first().locator('.release-cover').click({button:'right'});
  await page.locator('.release-card').first().locator('[data-act="embed"]').click();
  await expect.poll(async()=>!!(await plan(page))?.changes.find(change=>change.path===path)?.cover_change?.new?.length).toBe(true);
  await ready(page);expect(titleOf(await plan(page),path)).toBe('Keep these tags!');
  await expect(page.locator('#tracks-body tr[data-path]').first().locator('.track-artwork')).toHaveAttribute('data-cover-state','embedded');
  expect(await calls(page,'apply_plan')).toBe(0);
});

for (const theme of ['light', 'dark']) test(`source panel is quiet and animated in ${theme}`,async({page})=>{
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await releases(page);
  const card=page.locator('.release-card').first();
  await expect(card.locator('.tracklist-actions, [data-act="automatch"], .tk-fit, .tk-delta')).toHaveCount(0);
  await expect(card.locator('.media-badge .n')).toHaveText(/^[1-9][0-9]*$/);
  expect(await card.locator('.release-tracklist').evaluate(node=>getComputedStyle(node).animationName)).toBe('release-expand');
  await card.locator('.release-cover').focus();
  await page.keyboard.press('Shift+F10');
  await expect(card.locator('[data-act="embed"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card.locator('.tk-save-menu')).toBeHidden();
});

test('release import pairs checked tracks sequentially without reordering files',async({page})=>{
  await page.evaluate(()=>{
    for(const track of window.tagrex.tracks)window.tagrex.selection.add(track.path);
    window.tagrex.renderTracks();
  });
  const order=await page.evaluate(()=>window.tagrex.tracks.map(track=>track.path));
  await releases(page);
  const card=page.locator('.release-card').first();
  const id=await card.getAttribute('data-id');
  await card.locator('tbody [role="checkbox"]').first().click();
  await card.locator('.release-import').click();await ready(page);
  await expect.poll(async()=>titleOf(await plan(page),order[0])).toBe(`${id} track 2`);
  expect(titleOf(await plan(page),order[1])).toBe(`${id} track 3`);
  expect(await page.evaluate(()=>window.tagrex.tracks.map(track=>track.path))).toEqual(order);
  expect(await calls(page,'apply_plan')).toBe(0);
});

for (const count of [1,2,3]) test(`filename-sorted import maps ${count} selected files to checked source rows in display order`,async({page})=>{
  // Library scan order differs from the filename-sorted table; tags are already wrong.
  await page.evaluate(()=>{
    window.liveExtendedSource=true;
    const paths=['/music/CD 2/01 - wrong tags.mp3','/music/CD 1/02 - wrong tags.mp3','/music/CD 1/01 - wrong tags.mp3'];
    window.tagrex.tracks.forEach((track,index)=>track.path=paths[index]);
    window.tagrex.selection.clear();window.tagrex.renderTracks();
  });
  await page.locator('#tracks th[data-sort="file"]').click();
  const rows=page.locator('#tracks-body tr[data-path]');
  const displayed=await rows.evaluateAll(nodes=>nodes.map(node=>node.dataset.path));
  await page.evaluate(paths=>{for(const path of paths)window.tagrex.selection.add(path);window.tagrex.renderTracks();},displayed.slice(0,count));
  await releases(page);
  const card=page.locator('.release-card').first();const id=await card.getAttribute('data-id');
  // Skip the first source track and a gap in the middle: 2,4,5 are enabled first.
  await card.locator('tbody [role="checkbox"]').nth(0).click();
  await card.locator('tbody [role="checkbox"]').nth(2).click();
  await card.locator('.release-import').click();await ready(page);
  const expected=[2,4,5];
  for(let i=0;i<count;i++)await expect.poll(async()=>titleOf(await plan(page),displayed[i])).toBe(`${id} track ${expected[i]}`);
  expect(await calls(page,'apply_plan')).toBe(0);
  if(count===3){
    await page.evaluate(()=>{
      // Preview composition can return a different plan order; Apply must still
      // follow the table rather than relying on that incidental ordering.
      window.tagrex.previewPlan.changes.reverse();
      window.liveDelayApply=true;
      window.__TAURI__={event:{listen:async(_name,callback)=>{window.liveReport=callback;return ()=>{window.liveReport=null;};}}};
    });
    await page.locator('#diff-apply').click();
    await expect.poll(()=>calls(page,'apply_plan')).toBe(1);
    expect(await page.evaluate(()=>window.liveAppliedPaths)).toEqual(displayed);
    for(let i=0;i<count;i++){
      await page.evaluate(({path,done,total})=>window.liveReport({payload:{path,done,total}}),{path:displayed[i],done:count+i,total:count*2});
      await expect(page.locator('#tracks-body .applying-current')).toHaveAttribute('data-path',displayed[i]);
    }
    await expect(page.locator('#tracks-body .applying-current')).toHaveCount(0);
  }
});
