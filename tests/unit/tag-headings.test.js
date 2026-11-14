import test from 'node:test';
import assert from 'node:assert/strict';
import {readableTagName,titleCaseTagLabel} from '../../app/ui/js/tag-labels.js';
test('tag headings use Title Case and preserve abbreviations and brand names',()=>{
  assert.equal(readableTagName('custom:DISCOGS_RELEASE_ID'),'Discogs Release ID');
  assert.equal(readableTagName('custom:myCD_ID'),'My CD ID');
  assert.equal(titleCaseTagLabel('MusicBrainz album ID'),'MusicBrainz Album ID');
  assert.equal(titleCaseTagLabel('ReplayGain peak (track)'),'ReplayGain Peak (Track)');
  assert.equal(titleCaseTagLabel('Track position'),'Track Position');
  assert.equal(readableTagName('custom:unknown_raw_tag'),'Unknown Raw Tag');
  assert.equal(readableTagName('custom:album_CD_URL'),'Album CD URL');
});
