import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
const root=resolve('.test-dist');
test.beforeEach(async({page})=>{
  page.errors=[];page.on('pageerror',error=>page.errors.push(error.message));
  await page.route('http://tagrex.test/**',async route=>{
    const path=resolve(root,'.'+new URL(route.request().url()).pathname);if(!path.startsWith(root+sep))return route.abort();
    try{await route.fulfill({body:await readFile(path),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.woff2')?'font/woff2':'text/html'});}catch{await route.fulfill({status:404});}
  });
});
test.afterEach(async({page})=>expect(page.errors).toEqual([]));
async function open(page,large=false){
  if(large)await page.addInitScript(()=>{
    const original=Promise.resolve;
    Promise.resolve=function(value){
      if(Array.isArray(value)&&value.length===3&&value.every(track=>track.path&&track.tags)){
        const seed=structuredClone(value[0]);
        value.splice(0,value.length,...Array.from({length:400},(_,index)=>({...structuredClone(seed),path:`/music/${String(index).padStart(4,'0')}.mp3`,tags:{...seed.tags,artist:`Original ${index}`}})));
      }
      return original.call(this,value);
    };
  });
  await page.goto('http://tagrex.test/app/ui/index.html');
  await expect.poll(()=>page.evaluate(()=>typeof window.tagrex?.openLibrary)).toBe('function');
  await page.evaluate(async()=>{document.getElementById('root').value='/music';await window.tagrex.openLibrary();window.tagrex.selection.clear();for(const track of window.tagrex.tracks)window.tagrex.selection.add(track.path);window.tagrex.renderTracks();});
}
async function stageTags(page){
  await page.locator('.subtab[data-subtab="editor"]').click();
  await page.locator('#fields-body [data-key="artist"]').fill('Written artist');
  await expect(page.locator('#diff-apply')).toBeEnabled();
  await page.locator('#staged-tab').click();
}
async function holdApply(page){
  await page.evaluate(()=>{
    const originalTracks=window.tagrex.tracks.map(track=>structuredClone(track));
    window.__TAURI__={event:{listen:async(_event,callback)=>{window.writeProgress=payload=>callback({payload});return ()=>{window.writeProgress=null;};}}};
    const original=Promise.resolve;
    Promise.resolve=function(value){
      if(value?.id&&value?.description&&'applied_at' in value)return new Promise((resolve,reject)=>{window.finishWrite=()=>resolve(value);window.failWrite=()=>{window.tagrex.tracks.forEach((track,index)=>Object.assign(track,originalTracks[index]));reject({message:{code:'error.plan.cancelled'}});};});
      return original.call(this,value);
    };
    window.beforeRows=[...document.querySelectorAll('#tracks-body tr')];
    window.beforeCells=[...document.querySelectorAll('#tracks-body td')];
    window.beforeHeaders=[...document.querySelectorAll('#tracks thead th')];
    window.structuralChanges=0;
    window.progressObserver=new MutationObserver(records=>{
      for(const record of records)if(record.type==='childList'&&[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&['TR','TD','TH'].includes(node.nodeName)))window.structuralChanges++;
    });
    window.progressObserver.observe(document.getElementById('tracks'),{childList:true,subtree:true});
  });
  await page.locator('#diff-apply').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.finishWrite)).toBe('function');
}
const report=(page,event)=>page.evaluate(event=>window.writeProgress(event),event);
async function stable(page){
  expect(await page.evaluate(()=>window.structuralChanges)).toBe(0);
  expect(await page.evaluate(()=>window.beforeRows.every(node=>node.isConnected)&&window.beforeCells.every(node=>node.isConnected)&&window.beforeHeaders.every(node=>node.isConnected))).toBe(true);
}
async function finish(page){
  await page.evaluate(()=>{window.progressObserver.disconnect();window.finishWrite();});
  await expect(page.locator('#diff-actionbar')).toBeHidden();
  expect(await page.evaluate(()=>window.tagrex.selectedPaths())).toEqual([]);
  await expect(page.locator('#tracks-body tr.selected')).toHaveCount(0);
  await expect(page.locator('#tracks-body .sheet-active,#tracks-body .sheet-range')).toHaveCount(0);
}

for(const kind of ['tags','transfer'])test(`${kind} Apply patches values in order, clears completed selection, and retains every table node`,async({page},testInfo)=>{
  await open(page);
  if(kind==='tags')await stageTags(page);
  else {await page.locator('.mode-tab[data-mode="renamer"]').click();await page.locator('#mask').fill('Saved %artist% - %title%');await page.locator('#preview').click();await expect(page.locator('#diff-apply')).toBeEnabled();await page.locator('#staged-tab').click();}
  const changes=await page.evaluate(()=>window.tagrex.previewPlan.changes);
  await holdApply(page);
  const rows=page.locator('#tracks-body tr[data-path]');
  for(let index=0;index<changes.length;index++){
    const change=changes[index],row=rows.nth(index);
    const cell=kind==='tags'?row.locator('td[data-field="artist"]'):row.locator('.fname');
    await expect(cell).toContainText(kind==='tags'?change.tag_changes.find(field=>field.field==='artist').old:change.path.split('/').pop());
    await report(page,{path:change.path,done:changes.length+index,total:changes.length*2});
    await expect(row).toHaveClass(/applying-current/);
    await report(page,{path:change.path,done:changes.length+index+1,total:changes.length*2,completed:kind});
    await expect(cell).toContainText(kind==='tags'?'Written artist':change.rename_to.split('/').pop());
    await expect(row).not.toHaveClass(/selected/);await expect(row).toHaveAttribute('aria-disabled','true');
    await expect(row).not.toHaveClass(/applying-current/);
    await stable(page);
    if(index===0&&kind==='tags')for(const theme of ['light','dark']){
      await page.emulateMedia({colorScheme:theme});
      await page.screenshot({path:testInfo.outputPath(`progress-${theme}.png`),animations:'disabled'});
    }
  }
  await finish(page);
});

test('a cancelled transaction restores the same cells and preview selection',async({page})=>{
  await open(page);await stageTags(page);
  const first=await page.evaluate(()=>window.tagrex.previewPlan.changes[0].path);
  await holdApply(page);await report(page,{path:first,done:4,total:6,completed:'tags'});
  await expect(page.locator('#tracks-body tr[data-path]').first()).toHaveAttribute('aria-disabled','true');
  await page.evaluate(()=>window.failWrite());
  await expect(page.locator('#mode-col')).not.toHaveAttribute('inert','');
  await expect(page.locator('#tracks-body td[data-field="artist"]').first()).toContainText('Written artist');
  await expect(page.locator('#tracks-body tr[data-path]').first()).toHaveClass(/selected/);
  await expect(page.locator('#tracks-body tr[data-path]').first()).not.toHaveAttribute('aria-disabled','true');
  await stable(page);
});

test('a combined tag and rename row completes only after both writes, without replacing its cells',async({page})=>{
  await open(page);
  await page.locator('.mode-tab[data-mode="renamer"]').click();await page.locator('#mask').fill('Saved %title%');await page.locator('#preview').click();
  await expect(page.locator('#diff-apply')).toBeEnabled();
  const first=await page.evaluate(()=>{
    const change=window.tagrex.previewPlan.changes[0];
    change.tag_changes.push({field:'artist',old:window.tagrex.tracks[0].tags.artist,new:'Written artist'});
    window.tagrex.renderTracks();return change;
  });
  await holdApply(page);
  const row=page.locator('#tracks-body tr[data-path]').first();
  await report(page,{path:first.path,done:4,total:7,completed:'tags'});
  await expect(row.locator('td').nth(3)).toContainText('Written artist');
  await expect(row.locator('.fname')).toHaveText(first.path.split('/').pop());
  await expect(row).not.toHaveAttribute('aria-disabled','true');
  await report(page,{path:first.path,done:5,total:7,completed:'transfer'});
  await expect(row.locator('.fname')).toHaveText(first.rename_to.split('/').pop());
  await expect(row).toHaveAttribute('aria-disabled','true');await stable(page);await finish(page);
});

test('artwork changes update the existing icon only after its write completes',async({page})=>{
  await open(page);
  await page.evaluate(()=>{window.tagrex.selection.clear();window.tagrex.selection.add(window.tagrex.tracks[0].path);window.tagrex.renderTracks();});
  await page.locator('.subtab[data-subtab="editor"]').click();
  await page.locator('#cover-well .cover-edit').click();await page.getByRole('menuitem',{name:'Remove',exact:true}).click();
  await expect(page.locator('#diff-apply')).toBeEnabled();await page.locator('#staged-tab').click();
  const first=await page.evaluate(()=>window.tagrex.previewPlan.changes[0]);
  await holdApply(page);
  const art=page.locator('#tracks-body .track-artwork').first();
  await expect(art).toHaveAttribute('data-cover-state','embedded');
  await report(page,{path:first.path,done:2,total:2,completed:'tags'});
  await expect(art).toHaveAttribute('data-cover-state','missing');
  await expect(art).not.toHaveClass(/artwork-changing/);await stable(page);await finish(page);
});

test('large batches allow manual scrolling and remounted rows retain their completed values',async({page})=>{
  await open(page,true);await stageTags(page);
  const changes=await page.evaluate(()=>window.tagrex.previewPlan.changes);
  expect(changes).toHaveLength(400);
  await holdApply(page);
  await page.evaluate(changes=>{for(const change of changes.slice(0,350))window.writeProgress({path:change.path,done:401,total:800,completed:'tags'});},changes);
  await stable(page);
  const before=await page.locator('#files-view').evaluate(node=>node.scrollTop);
  expect(before).toBe(0);
  await page.locator('#files-view').hover();await page.mouse.wheel(0,4200);
  await expect.poll(()=>page.locator('#files-view').evaluate(node=>node.scrollTop)).toBeGreaterThan(3000);
  await expect(page.locator('#tracks-body tr[data-path]').first()).toHaveAttribute('aria-disabled','true');
  await expect(page.locator('#tracks-body td[data-field="artist"]').first()).toContainText('Written artist');
  const scroll=await page.locator('#files-view').evaluate(node=>node.scrollTop);
  await report(page,{path:changes[399].path,done:799,total:800});
  expect(await page.locator('#files-view').evaluate(node=>node.scrollTop)).toBe(scroll);
  await finish(page);
});

test('Apply highlight transitions honour reduced motion',async({page})=>{
  await open(page);await stageTags(page);await holdApply(page);
  const cell=page.locator('#tracks-body td[data-field="artist"]').first();
  expect(await cell.evaluate(node=>getComputedStyle(node).transitionDuration)).not.toBe('0s');
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await cell.evaluate(node=>getComputedStyle(node).transitionDuration)).toBe('0s');
  await finish(page);
});
