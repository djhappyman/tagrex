import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewColumns} from '../../app/ui/js/review-columns.js';

test('Staged shows only changed fields in normal order without mutating Files',()=>{
  const files=['file','title','year'];const available=['file','title','year','publisher','catalognumber'];
  const changes=[{tag_changes:[{field:'catalognumber',old:'old',new:'new'},{field:'custom:UNKNOWN',old:null,new:'value'},{field:'title',old:'old',new:'new'}]}];
  const columns=reviewColumns(files,available,changes);
  assert.deepEqual(columns,['file','title','catalognumber','custom:UNKNOWN']);
  assert.deepEqual(files,['file','title','year']);assert.equal(new Set(columns).size,columns.length);
});
test('empty and artwork-only plans keep File without unrelated tags',()=>{
  for(const changes of [[],[{tag_changes:[],cover_change:{old:[],new:[{}]}}]])assert.deepEqual(reviewColumns(['file','title'],['file','title','year'],changes),['file']);
});
test('last reverts hide columns; null/empty no-ops disappear but invalid drafts remain',()=>{
  const files=['file','title','year','artist'];
  const changes=[{tag_changes:[
    {field:'title',old:'same',new:'same'},
    {field:'year',old:null,new:''},
    {field:'artist',old:'',new:null},
    {field:'track',old:null,new:'',invalid:true},
  ]},{tag_changes:[{field:'year',old:'2003',new:'2004'}]}];
  assert.deepEqual(reviewColumns(files,['track'],changes),['file','year','track']);
  assert.deepEqual(reviewColumns(files,['track'],changes.slice(0,1)),['file','track']);
});
