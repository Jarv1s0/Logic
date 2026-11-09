import test from 'node:test';
import assert from 'node:assert/strict';
import {readTimeline,mergeTimelines} from '../src/vendor/timeline.mjs';
const samples={
 json3:JSON.stringify({events:[{tStartMs:0,dDurationMs:1000,wWinId:1,segs:[{utf8:'First '}],metadata:{padding:'x'.repeat(10000)}},{tStartMs:500,dDurationMs:1000,wWinId:1,aAppend:1,segs:[{utf8:'line'}]},{tStartMs:3000,dDurationMs:2000,segs:[{utf8:'Second & 🎬'}]}]}),
 srv3:'<timedtext><head><pen id="0"/></head><body><p t="3000" d="2000" w="1"><s>Second &amp; 🎬</s></p><p t="0" d="1500"><s>First line</s></p></body></timedtext>',
 srv1:'<transcript><text start="0" dur="1.5">First line</text><text start="3" dur="2">Second &amp; 🎬</text></transcript>',
 vtt:'WEBVTT\r\n\r\nNOTE private metadata\r\nkeep\r\n\r\nid1\r\n00:00:00.000 --> 00:00:01.500 position:20%\r\nFirst line\r\n\r\nid2\r\n00:00:03.000 --> 00:00:05.000\r\nSecond &amp; 🎬\r\n'
};
for(const [format,sample]of Object.entries(samples)){
 test(format+' alignment-only transcript retains identical intervals/text without rendering metadata',()=>{
  const full=readTimeline(sample),lean=readTimeline(sample,{renderable:false});assert.equal(full.format,lean.format);assert.equal(lean.render,undefined);
  assert.deepEqual(lean.cues,full.cues.map(({start,end,words})=>({start,end,words})));assert.ok(lean.cues.every(c=>Object.keys(c).length===3));
 });
 test(format+' alignment-only companion produces byte-identical translation and bilingual output',()=>{
  const target='<timedtext><body><p t="0" d="1500" w="2"><s>第一句</s></p><p t="3000" d="2000"><s>第二句</s></p></body></timedtext>';
  for(const dual of [false,true])assert.equal(mergeTimelines(readTimeline(target),readTimeline(sample,{renderable:false}),{baseOriginal:false,dual,layout:true,language:'zh-Hant'}),mergeTimelines(readTimeline(target),readTimeline(sample),{baseOriginal:false,dual,layout:true,language:'zh-Hant'}));
 });
}
