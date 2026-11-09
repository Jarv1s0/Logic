import test from 'node:test';
import assert from 'node:assert/strict';
import {formatTranslation} from '../src/vendor/caption-layout.mjs';
import {readTimeline,reflowTimeline} from '../src/vendor/timeline.mjs';
import {Settings,utf8,fromUtf8} from '../src/vendor/data.mjs';
import {handleCaption} from '../src/vendor/captions.mjs';
// Adapt the upstream caption tests to the directly imported caption module;
// the upstream playback runtime is deliberately not shipped by this plugin.
async function handle(io, settings) {
  const diagnostic = {};
  const result = await handleCaption(io, settings, diagnostic, 'X-YouTubeClean-Internal');
  io.report(diagnostic);
  return result;
}

// Self-written timelines. No signed video URLs or user transcript is a fixture.
const words='今天先把這個問題說清楚。我們明天再一起討論下一個步驟。';
const korean='원래 문장은 그대로 유지합니다.';
const url='https://www.youtube.com/api/timedtext?v=LAYOUT-FIXTURE&lang=ko&format=srv3';
const settings=extra=>new Settings({TARGET_LANGUAGE:'zh-Hant',BILINGUAL:false,...extra});
const documents={
  srv3:text=>'<timedtext format="3"><head><wp id="0" ap="7"/></head><body><p t="1234" d="4321" w="0" custom="keep"><s>'+text+'</s></p></body></timedtext>',
  srv1:text=>'<transcript><text start="1.234" dur="4.321" custom="keep">'+text+'</text></transcript>',
  json3:text=>JSON.stringify({wireMagic:'keep',events:[{tStartMs:1234,dDurationMs:4321,wWinId:2,custom:'keep',segs:[{utf8:text}]}]}),
  vtt:text=>'WEBVTT\r\n\r\nNOTE keep metadata\r\n\r\ncue-1\r\n00:01.234 --> 00:05.555 align:middle position:50%\r\n'+text+'\r\n'
};
function context(body=documents.srv3(korean),targetOnly=false){
  const requests=[],reports=[];
  return{requests,reports,io:{url:url+(targetOnly?'&tlang=zh-Hant':''),phase:'response',status:200,body:utf8(body),responseHeaders:{},requestHeaders:{},store:{read:()=>null,write:()=>true},report:d=>reports.push(d),download:async u=>{requests.push(u);return{status:200,body:utf8(documents.srv3(words))};}}};
}
function lines(text){return text.split('\n');}
function intact(text,original){assert.equal(text.replace(/\s/g,''),original.replace(/\s/g,''));assert.ok(lines(text).length<=2);assert.ok(lines(text).every(x=>x.length));assert.ok(!/[\ud800-\udfff]/u.test(text.replace(/[\u{10000}-\u{10ffff}]/gu,'')));}

test('short Chinese translations remain a single line',()=>assert.equal(formatTranslation('明天見。','zh-Hant'),'明天見。'));
test('long Chinese translations wrap at a natural sentence boundary without losing text',()=>{
  const out=formatTranslation(words,'zh-Hant');intact(out,words);assert.equal(lines(out).length,2);assert.ok(/[。！？；，、：]$/.test(lines(out)[0]));assert.ok(lines(out).every(x=>x.length>=6));
});
test('Chinese punctuation spacing is tidied without changing simplified or traditional characters',()=>{
  assert.equal(formatTranslation('「 好的 」 ， 我們明天見 。','zh-Hant'),'「好的」，我們明天見。');
  assert.equal(formatTranslation('好的 ， 我们明天见 。','zh-Hans'),'好的，我们明天见。');
});
test('the formatter does not convert Chinese character variants',()=>assert.equal(formatTranslation('我们一起讨论這個問題。','zh-Hant'),'我们一起讨论這個問題。'));
test('English sentences wrap at word boundaries and preserve exact spelling',()=>{
  const text='Please review the complete subtitle before deciding the next step.',out=formatTranslation(text,'en');assert.equal(out.replace('\n',' '),text);assert.equal(lines(out).length,2);
});
test('English numbers and URLs are not split internally',()=>{
  const text='Please open https://example.org/path?q=3.14159 and check version 12.34 carefully.',out=formatTranslation(text,'en');assert.equal(out.replace('\n',' '),text);assert.ok(out.includes('https://example.org/path?q=3.14159'));assert.ok(out.includes('12.34'));
});
test('a single unbreakable word is left to the native player rather than truncated',()=>{const text='Unbreakable'.repeat(30);assert.equal(formatTranslation(text,'en'),text);});
for(const text of [
  '我們先一起檢查這段字幕（這是一個完整說明）然後繼續下一個問題。',
  '我們先一起檢查這段字幕「請保留所有內容」然後繼續下一個問題。',
  '今天我們一起討論這個問題，明天再繼續下一個完整的步驟。',
])test('wrapped lines keep closing punctuation with the preceding text: '+text,()=>{
  const out=formatTranslation(text,'zh-Hant');intact(out,text);for(const line of lines(out)){assert.ok(!/^[，。！？；：、」』】〕〉》）]/.test(line));assert.ok(!/[「『【〔〈《（]$/.test(line));}
});
test('emoji sequences, variation selectors, combining marks and astral Han stay intact',()=>{
  const text='今天我們一起看👩🏽‍💻的字幕，咖啡cafe\u0301☕️以及𠮷\u{e0100}字全部保留，明天再繼續。',out=formatTranslation(text,'zh-Hant');intact(out,text);for(const piece of ['👩🏽‍💻','cafe\u0301','☕️','𠮷\u{e0100}'])assert.ok(out.includes(piece));
});
test('very long translations are fully preserved with at most one inserted break',()=>{const text='完整保留所有字幕，'.repeat(10000),out=formatTranslation(text,'zh-Hant');intact(out,text);assert.equal(lines(out).length,2);});
test('layout parameters accept native booleans and string values',()=>{assert.equal(new Settings().layout,true);assert.equal(settings({CAPTION_LAYOUT:false}).layout,false);assert.equal(settings({CAPTION_LAYOUT:'false'}).layout,false);assert.equal(settings({CAPTION_LAYOUT:true}).layout,true);});

for(const [format,document]of Object.entries(documents)){
  for(const provider of ['youtube','google'])test(format+' '+provider+' translation-only layout retains cue timing and envelope',async()=>{
    const c=context(document(korean));if(provider==='google'){c.io.download=async u=>{c.requests.push(u);return{status:429,headers:{},body:utf8('limited')};};c.io.translate=async()=>({status:200,body:utf8(JSON.stringify([words]))});}
    const out=await handle(c.io,settings()),text=fromUtf8(out.body),timeline=readTimeline(text);
    assert.equal(timeline.format,format);assert.equal(timeline.cues[0].start,1234);assert.equal(timeline.cues[0].end,5555);assert.equal(timeline.cues[0].words,formatTranslation(words,'zh-Hant'));assert.ok(!text.includes(korean));assert.equal(c.requests.length,1);assert.equal(c.reports[0].captionLayout,'balanced');assert.equal(c.reports[0].captionProvider,provider);
    if(format==='json3'){const doc=JSON.parse(text);assert.equal(doc.wireMagic,'keep');assert.equal(doc.events[0].custom,'keep');assert.equal(doc.events[0].wWinId,2);}
    else if(format==='vtt'){assert.ok(text.includes('NOTE keep metadata'));assert.ok(text.includes('align:middle position:50%'));assert.ok(text.includes('\r\n'));}
    else assert.ok(text.includes('custom="keep"'));
  });
}
for(const provider of ['youtube','google'])test(provider+' bilingual layout leaves original words untouched above the formatted translation',async()=>{
  const c=context();if(provider==='google'){c.io.download=async()=>({status:429,body:utf8('limited')});c.io.translate=async()=>({status:200,body:utf8(JSON.stringify([words]))});}
  const out=await handle(c.io,settings({BILINGUAL:true}));assert.equal(readTimeline(fromUtf8(out.body)).cues[0].words,korean+'\n'+formatTranslation(words,'zh-Hant'));
});
test('disabling layout preserves the previous translation text for both providers',async()=>{
  for(const provider of ['youtube','google']){const c=context();if(provider==='google'){c.io.download=async()=>({status:429,body:utf8('limited')});c.io.translate=async()=>({status:200,body:utf8(JSON.stringify([words]))});}const out=await handle(c.io,settings({CAPTION_LAYOUT:false}));assert.equal(readTimeline(fromUtf8(out.body)).cues[0].words,words);assert.equal(c.reports[0].captionLayout,'off');}
});
for(const [format,document]of Object.entries(documents))test(format+' already translated native track can reflow without any network request',async()=>{
  const c=context(document(words),true),out=await handle(c.io,settings());assert.ok(out?.body);assert.equal(readTimeline(fromUtf8(out.body)).cues[0].words,formatTranslation(words,'zh-Hant'));assert.equal(c.requests.length,0);assert.equal(c.reports[0].reason,'caption-layout');
});
test('native target-only short tracks pass through without serialization or network',async()=>{const c=context(documents.srv3('明天見。'),true);assert.equal(await handle(c.io,settings()),null);assert.equal(c.requests.length,0);});
test('native target-only layout switch can preserve long captions unchanged',async()=>{const c=context(documents.srv3(words),true);assert.equal(await handle(c.io,settings({CAPTION_LAYOUT:false})),null);assert.equal(c.requests.length,0);});
test('text-only JSON3 layout does not invent duration or erase append flags',()=>{
  const doc={events:[{tStartMs:7000,aAppend:1,wWinId:8,custom:'keep',segs:[{utf8:words}]}]},out=JSON.parse(reflowTimeline(readTimeline(JSON.stringify(doc)),'zh-Hant'));
  assert.equal(out.events[0].dDurationMs,undefined);assert.equal(out.events[0].aAppend,1);assert.equal(out.events[0].custom,'keep');assert.equal(out.events[0].tStartMs,7000);
});
test('rolling JSON3 append groups are left intact by text-only layout',()=>{
  const doc={events:[{tStartMs:0,dDurationMs:2000,segs:[{utf8:words}]},{tStartMs:1000,dDurationMs:2000,aAppend:1,segs:[{utf8:'以及後續的文字。'}]}]};assert.equal(reflowTimeline(readTimeline(JSON.stringify(doc)),'zh-Hant'),null);
});
test('source-language Chinese tracks retain the native author layout',async()=>{const c=context(documents.srv3(words));c.io.url=url.replace('lang=ko','lang=zh-Hant');assert.equal(await handle(c.io,settings()),null);assert.equal(c.requests.length,0);});
test('manual translated bilingual track formats only the translated side',async()=>{
  const c=context(documents.srv3(words),true);c.io.download=async u=>{c.requests.push(u);return{status:200,body:utf8(documents.srv3(korean))};};
  const out=await handle(c.io,settings({BILINGUAL:true}));assert.equal(readTimeline(fromUtf8(out.body)).cues[0].words,korean+'\n'+formatTranslation(words,'zh-Hant'));assert.equal(c.requests.length,1);
});
