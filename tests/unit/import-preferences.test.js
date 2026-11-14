import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../app/ui/js/import-preferences.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'');
function harness(disk){
  const context=vm.createContext({
    savedSettings:{},document:{dispatchEvent(){}},CustomEvent:class{},
    setSavedSettings:settings=>{context.savedSettings=settings;},
    invoke:async(command,args)=>{
      if(command==='load_settings')return structuredClone(disk.settings);
      if(command==='import_fields')return [{keys:['title'],label:'Title'}];
      if(command==='save_settings'){
        if(disk.fail)throw Error('save failed');
        disk.settings=structuredClone(args.settings);return;
      }
      throw Error(command);
    },
  });
  vm.runInContext(source,context);return context;
}
test('import choices survive a fresh UI session and preserve unrelated settings',async()=>{
  const disk={settings:{proxy:'keep',import_skip_fields:[],import_cover:'if-missing'}};
  const first=harness(disk);await first.loadImportPreferences();
  await Promise.all([first.saveImportPreferences({import_skip_fields:['title']}),first.saveImportPreferences({import_cover:'never'})]);
  const second=harness(disk);const restored=await second.loadImportPreferences();
  assert.deepEqual(Array.from(restored.settings.import_skip_fields),['title']);
  assert.equal(restored.settings.import_cover,'never');assert.equal(restored.settings.proxy,'keep');
});
test('failed preference saves retain the prior configuration and permit retry',async()=>{
  const disk={settings:{import_cover:'never',import_skip_fields:[]},fail:true};
  const context=harness(disk);await context.loadImportPreferences();
  await assert.rejects(context.saveImportPreferences({import_cover:'always'}));
  assert.equal(context.savedSettings.import_cover,'never');
  disk.fail=false;await context.saveImportPreferences({import_cover:'always'});
  assert.equal((await context.prepareImportPreferences()).import_cover,'always');
});
test('the explicit artwork choice migrates an enabled legacy policy and keeps disabled artwork disabled',async()=>{
  for(const [stored,expected] of [['if-missing','always'],['never','never']]){
    const disk={settings:{import_cover:stored,import_skip_fields:[]}};
    assert.equal((await harness(disk).prepareImportPreferences()).import_cover,expected);
    assert.equal(disk.settings.import_cover,expected);
  }
});
