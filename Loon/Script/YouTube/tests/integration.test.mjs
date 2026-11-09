import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readTimeline} from '../src/vendor/timeline.mjs';
import {combine, binary, string, integer, opaque, guide, ids, player, at, all, inspect,
  homeFirstPage, homeContinuationPage, homeSection, homeContents,
  captionUrl, originalCaptions, translatedCaptions} from './fixtures.mjs';

const sources = Object.fromEntries(await Promise.all(['feed','feed-request','caption','playback-request',
  'playback-response','config','config-request','logger','channels','request','response']
  .map(async name => [name, await readFile(new URL('../'+name+'.min.js', import.meta.url), 'utf8')])));
const api = endpoint => 'https://youtubei.googleapis.com/youtubei/v1/' + endpoint;
function invoke(lane, {url=api('browse'), args={}, body, requestBody, phase='response', status=200,
  headers={'Content-Type':'application/x-protobuf'}, requestHeaders={}, store=new Map(), http, extra={}}={}) {
  const results=[], logs=[], calls=[];
  const context={Uint8Array, Uint16Array, Uint32Array, ArrayBuffer, DataView, TextEncoder, TextDecoder,
    setTimeout, clearTimeout, atob, btoa, $loon:'Loon', $argument:args,
    $request:{url, method:'GET', headers:requestHeaders, ...(requestBody==null?{}:{body:requestBody})},
    $persistentStore:{read:key=>store.get(key),write:(value,key)=>{if(value==null)store.delete(key);else store.set(key,value);return true;}},
    $httpClient:{get:(request, callback)=>{calls.push(request);if(http)http(request,callback);else callback('unexpected network');}},
    $notification:{post:()=>{}}, console:{log:(...items)=>logs.push(items.join(' '))},
    $done:result=>results.push(result), ...extra};
  if(phase==='response')context.$response={status,headers,body};
  vm.runInNewContext(sources[lane],context,{timeout:3000});
  return {results,logs,calls,store,context};
}
async function settled(run) { for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));return run; }
const output=(run,original)=>run.results[0]?.body??original;
function node(name, children=[]) {
  return combine(binary(1,binary(168777401,combine(
    binary(3,binary(172035250,string(1,name+'.eml-fe|self-written-fixture'))),opaque))),
    ...children.map(child=>binary(3,child)),opaque);
}
const card=name=>binary(153515154,combine(binary(172660663,node(name)),opaque));
const templates=['video_display_full_buttoned_layout','video_display_full_layout',
  'full_width_square_image_layout','full_width_portrait_image_layout','landscape_image_wide_button_layout',
  'square_image_layout','text_image_button_layout','grid_ads_image_layout',
  'carousel_headered_layout','carousel_footered_layout','brand_video_shelf'];
for(const [kind,make]of [['first',homeFirstPage],['continuation',homeContinuationPage]])
  test('shipped feed removes display templates and preserves ordinary '+kind+' page bytes',()=>{
    const keep=homeSection([card('video_lockup_with_attachment'),card('cell_divider')]);
    const body=make([homeSection(templates.map(card)),keep]);
    const run=invoke('feed',{body});
    assert.equal(run.results.length,1);
    assert.deepEqual(homeContents(output(run,body),kind).map(Buffer.from),[Buffer.from(keep)]);
    assert.deepEqual(Buffer.from(at(output(run,body),499)),Buffer.from(at(body,499)));
    assert.equal(run.calls.length,0);
  });
test('new 474376530 mixed container removes ads without dropping its neighboring videos',()=>{
  const good=card('video_lockup_with_attachment');
  const envelope=binary(474376530,combine(binary(1,card('full_width_square_image_layout')),binary(1,good),opaque));
  const body=homeFirstPage([homeSection([envelope])]);
  const expected=homeFirstPage([homeSection([binary(474376530,combine(binary(1,good),opaque))])]);
  const run=invoke('feed',{body});
  assert.deepEqual(Buffer.from(output(run,body)),expected);
  assert.equal(run.results.length,1);
});
test('ordinary text and global template resources do not become advertising evidence',()=>{
  const body=combine(homeFirstPage([homeSection([card('video_lockup_with_attachment')])]),
    string(499,'full_width_square_image_layout sponsored ads'),binary(777,card('full_width_square_image_layout')));
  const run=invoke('feed',{body});
  assert.deepEqual(Buffer.from(output(run,body)),body);
});
test('new container work-budget exhaustion rolls back its pending edits',()=>{
  let branch=string(99,'ordinary opaque data');
  for(let i=0;i<9;i++)branch=binary(2,branch);
  const envelope=binary(474376530,combine(binary(1,card('full_width_square_image_layout')),
    ...Array.from({length:1500},()=>binary(1,branch))));
  const body=homeFirstPage([homeSection([envelope])]);
  const run=invoke('feed',{body,args:{log_enabled:true}});
  assert.deepEqual(Buffer.from(output(run,body)),body);
  const trace=run.logs.find(line=>line.startsWith('[YouTube] '));
  assert.ok(JSON.parse(trace.slice('[YouTube] '.length)).envelopeBypasses>0);
});
test('the composed feed handler is idempotent',()=>{
  const body=homeFirstPage([homeSection([card('full_width_square_image_layout'),card('video_lockup_with_attachment')])]);
  const once=output(invoke('feed',{body}),body);
  assert.deepEqual(Buffer.from(output(invoke('feed',{body:once}),once)),Buffer.from(once));
});
test('feed gzip is decoded and stale representation headers are removed after modification',()=>{
  const body=homeFirstPage([homeSection([card('full_width_square_image_layout'),card('video_lockup_with_attachment')])]);
  const run=invoke('feed',{body:gzipSync(body),headers:{'Content-Type':'application/x-protobuf','Content-Encoding':'gzip','Content-Length':'123','ETag':'old'}});
  assert.deepEqual(Buffer.from(output(run,body)),homeFirstPage([homeSection([card('video_lockup_with_attachment')])]));
  const headers=run.results[0].headers;
  for(const key of ['content-encoding','content-length','etag'])assert.ok(!Object.keys(headers).some(name=>name.toLowerCase()===key));
});
for(const [args,expected]of [
  [{},['FEwhat_to_watch','FEshorts','FEuploads','FEsubscriptions','FElibrary']],
  [{hide_upload:true},['FEwhat_to_watch','FEshorts','FEsubscriptions','FElibrary']],
  [{hide_bottom_shorts:true},['FEwhat_to_watch','FEuploads','FEsubscriptions','FElibrary']],
  [{hide_upload:true,hide_bottom_shorts:true},['FEwhat_to_watch','FEsubscriptions','FElibrary']]
])test('independent navigation settings '+JSON.stringify(args),()=>{
  const body=guide(),run=invoke('feed',{url:api('guide'),args,body});
  for(const root of [4,6])assert.deepEqual(ids(output(run,body),root),expected);
  assert.equal(run.results.length,1);
});
test('home Shorts preference does not hide the bottom Shorts entry',()=>{
  const body=guide(),run=invoke('feed',{url:api('guide'),args:{hide_home_shorts:true},body});
  assert.ok(ids(output(run,body)).includes('FEshorts'));
});
test('JSON navigation hides only the selected bottom bar items',()=>{
  const body=JSON.stringify({pivotBarRenderer:{items:[
    {pivotBarItemRenderer:{navigationEndpoint:{browseEndpoint:{browseId:'FEuploads'}}}},
    {pivotBarItemRenderer:{navigationEndpoint:{browseEndpoint:{browseId:'FEshorts'}}}},
    {pivotBarItemRenderer:{navigationEndpoint:{browseEndpoint:{browseId:'FEsubscriptions'}}}}
  ]},normal:{title:'FEuploads'}});
  const run=invoke('feed',{url:api('guide'),body,args:{hide_upload:true},headers:{'Content-Type':'application/json'}});
  const result=JSON.parse(Buffer.from(output(run,body)).toString());
  assert.equal(result.pivotBarRenderer.items.length,2);assert.equal(result.normal.title,'FEuploads');
});
test('original channel blocking remains effective after new advertisement filtering',()=>{
  const body=JSON.stringify({contents:{richGridRenderer:{contents:[
    {richItemRenderer:{content:{videoRenderer:{videoId:'blocked',ownerText:{runs:[{text:'Bad Channel',navigationEndpoint:{browseEndpoint:{browseId:'UCabcdefghijklmnopqrstuv'}}}]}}}}},
    {richItemRenderer:{content:{videoRenderer:{videoId:'retained',ownerText:{runs:[{text:'Good Channel',navigationEndpoint:{browseEndpoint:{browseId:'UC1234567890123456789012'}}}]}}}}}
  ]}}});
  const run=invoke('feed',{body,args:{blocked_channels:'UCabcdefghijklmnopqrstuv'},headers:{'Content-Type':'application/json'}});
  const result=JSON.parse(Buffer.from(output(run,body)).toString());
  assert.equal(result.contents.richGridRenderer.contents.length,1);
  assert.equal(result.contents.richGridRenderer.contents[0].richItemRenderer.content.videoRenderer.videoId,'retained');
});
test('navigation cache invalidation preserves account headers and is disabled by default',()=>{
  const requestHeaders={'If-None-Match':'old','If-Modified-Since':'yesterday',Authorization:'private'};
  const off=invoke('feed-request',{phase:'request',url:api('guide'),requestHeaders});
  assert.deepEqual(Object.keys(off.results[0]),[]);
  const on=invoke('feed-request',{phase:'request',url:api('guide'),requestHeaders,args:{hide_upload:true}});
  assert.equal(on.results[0].headers.Authorization,'private');assert.equal(on.results[0].headers['Cache-Control'],'no-cache');
  assert.ok(!('If-None-Match'in on.results[0].headers));
});
for(const args of [ {}, {translation_enabled:false}, {translation_enabled:true,translation_target:'en-US'} ])
  test('caption disabled or already in target language preserves original response '+JSON.stringify(args),async()=>{
    const run=await settled(invoke('caption',{url:captionUrl,body:originalCaptions,args}));
    assert.equal(run.results.length,1);assert.deepEqual(Object.keys(run.results[0]),[]);assert.equal(run.calls.length,0);
  });
for(const [target,language]of [['zh-CN','zh-Hans'],['zh-TW','zh-Hant'],['en-US','en'],['ja','ja'],['ko','ko']])
  test('caption uses saved target language '+target+' and preserves native timing',async()=>{
    const url=captionUrl.replace('lang=en','lang=fr');
    const run=await settled(invoke('caption',{url,body:originalCaptions,args:{translation_enabled:true,translation_target:target,caption_layout:false},
      http:(request,callback)=>callback(null,{status:200,headers:{}},translatedCaptions)}));
    assert.equal(run.results.length,1);assert.equal(run.calls.length,1);
    assert.equal(new URL(run.calls[0].url).searchParams.get('tlang'),language);
    const result=JSON.parse(Buffer.from(run.results[0].body).toString());
    assert.deepEqual(result.events.map(e=>e.tStartMs),[1000,3000]);
    assert.equal(result.events[0].segs[0].utf8,'一行中文');
    assert.equal(run.calls[0]['auto-cookie'],false);assert.equal(run.calls[0]['auto-redirect'],false);
  });
test('bilingual captions combine original and translation without forwarding credentials',async()=>{
  const run=await settled(invoke('caption',{url:captionUrl,body:originalCaptions,
    args:{translation_enabled:true,translation_bilingual:true,caption_layout:false},
    requestHeaders:{Cookie:'private',Authorization:'private','User-Agent':'YouTube'},
    http:(request,callback)=>{callback(null,{status:200,headers:{}},translatedCaptions);callback(null,{status:200},'late');}}));
  assert.equal(run.results.length,1);assert.equal(run.calls.length,1);
  const text=JSON.parse(Buffer.from(run.results[0].body).toString()).events[0].segs[0].utf8;
  assert.equal(text,'An original "line"\n一行中文');
  assert.ok(!Object.keys(run.calls[0].headers).some(key=>/cookie|authorization/i.test(key)));
});
for(const [format,document]of Object.entries({
  srv3:text=>'<timedtext format="3"><body><p t="1000" d="2000" custom="keep"><s>'+text+'</s></p></body></timedtext>',
  srv1:text=>'<transcript><text start="1" dur="2" custom="keep">'+text+'</text></transcript>',
  vtt:text=>'WEBVTT\n\ncue-1\n00:01.000 --> 00:03.000 align:middle\n'+text+'\n'
}))test('shipped subtitle lane preserves '+format+' envelope, times and bilingual text',async()=>{
  const body=document('Original words'),translated=document('翻译文字');
  const run=await settled(invoke('caption',{url:captionUrl,body,args:{translation_enabled:true,translation_bilingual:true,caption_layout:false},
    http:(request,callback)=>callback(null,{status:200},translated)}));
  const raw=Buffer.from(run.results[0].body).toString(),timeline=readTimeline(raw);
  assert.equal(timeline.format,format);assert.equal(timeline.cues[0].start,1000);assert.equal(timeline.cues[0].end,3000);
  assert.equal(timeline.cues[0].words,'Original words\n翻译文字');
  assert.ok(raw.includes(format==='vtt'?'align:middle':'custom="keep"'));
});
test('shipped subtitle layout toggle changes line wrapping and preserves all translated characters',async()=>{
  const text='今天先把这个问题说清楚。我们明天再一起讨论下一个步骤。';
  const reply=JSON.stringify({events:[{tStartMs:1000,dDurationMs:1500,segs:[{utf8:text}]}]});
  const run=async caption_layout=>settled(invoke('caption',{url:captionUrl,body:originalCaptions,args:{translation_enabled:true,caption_layout},
    http:(request,callback)=>callback(null,{status:200},reply)}));
  const off=JSON.parse(Buffer.from((await run(false)).results[0].body).toString()).events[0].segs[0].utf8;
  const on=JSON.parse(Buffer.from((await run(true)).results[0].body).toString()).events[0].segs[0].utf8;
  assert.equal(off,text);assert.ok(on.includes('\n'));assert.equal(on.replaceAll('\n',''),text);
});
test('a subtitle timeout preserves the original and a late callback cannot complete twice',async()=>{
  let callback,timeout;
  const run=invoke('caption',{url:captionUrl,body:originalCaptions,args:{translation_enabled:true},
    http:(request,cb)=>{callback=cb;},extra:{setTimeout:fn=>{timeout=fn;return 1;},clearTimeout:()=>{}}});
  assert.equal(run.results.length,0);timeout();await settled(run);
  assert.equal(run.results.length,1);assert.deepEqual(Object.keys(run.results[0]),[]);
  callback(null,{status:200},translatedCaptions);await settled(run);
  assert.equal(run.results.length,1);
});
for(const [name,http]of [
  ['network error',(request,callback)=>callback('offline')],
  ['invalid body',(request,callback)=>callback(null,{status:200},'<html>error</html>')],
  ['HTTP 500',(request,callback)=>callback(null,{status:500},'error')]
])test('caption failure preserves the complete original: '+name,async()=>{
  const run=await settled(invoke('caption',{url:captionUrl,body:originalCaptions,args:{translation_enabled:true},http}));
  assert.equal(run.results.length,1);assert.deepEqual(Object.keys(run.results[0]),[]);assert.equal(run.calls.length,1);
});
test('caption HTTP 429 activates bounded backoff and avoids a second request',async()=>{
  const store=new Map(),args={translation_enabled:true};
  const one=await settled(invoke('caption',{url:captionUrl,body:originalCaptions,args,store,
    http:(request,callback)=>callback(null,{status:429,headers:{'Retry-After':'60'}},'limited')}));
  assert.equal(one.calls.length,1);assert.equal(one.results.length,1);
  const two=await settled(invoke('caption',{url:captionUrl,body:originalCaptions,args,store}));
  assert.equal(two.calls.length,0);assert.deepEqual(Object.keys(two.results[0]),[]);
});
test('signed tlang, unknown formats and oversized captions do not issue downloads',async()=>{
  for(const input of [{url:captionUrl+'&sparams=lang,tlang',body:originalCaptions},
    {url:captionUrl,body:'unknown format'}, {url:captionUrl,body:'x'.repeat(1048577)}]){
    const run=await settled(invoke('caption',{...input,args:{translation_enabled:true}}));
    assert.equal(run.results.length,1);assert.equal(run.calls.length,0);assert.deepEqual(Object.keys(run.results[0]),[]);
  }
});
test('internal companion requests bypass subtitle processing',async()=>{
  const run=await settled(invoke('caption',{url:captionUrl,body:originalCaptions,args:{translation_enabled:true},requestHeaders:{'x-youtubeclean-internal':'1'}}));
  assert.equal(run.calls.length,0);assert.equal(run.results.length,1);assert.deepEqual(Object.keys(run.results[0]),[]);
});
test('bare youtube.com retains the previously supported caption endpoint',async()=>{
  const run=await settled(invoke('caption',{url:captionUrl.replace('www.youtube','youtube'),body:originalCaptions,args:{translation_enabled:true},
    http:(request,callback)=>callback(null,{status:200,headers:{}},translatedCaptions)}));
  assert.equal(run.calls.length,1);assert.ok(run.results[0].body);
});
test('logging starts, exports and clears through the split request lanes',()=>{
  const store=new Map();
  const started=invoke('feed-request',{phase:'request',args:{log_enabled:true},store});
  assert.equal(started.results.length,1);assert.equal(JSON.parse(store.get('ytads.logger.config.v1')).enabled,true);
  const page=invoke('logger',{phase:'request',url:'http://youtube-logs.invalid/',args:{log_enabled:true},store});
  assert.equal(page.results.length,1);assert.equal(page.results[0].response.status,200);
  assert.ok(page.results[0].response.body.includes('Download log'));
  invoke('feed-request',{phase:'request',args:{log_enabled:false},store});
  assert.equal(JSON.parse(store.get('ytads.logger.config.v1')).enabled,false);
});
test('existing JSON playback still removes ads and enables background playback only when requested',()=>{
  const body=JSON.stringify({playabilityStatus:{status:'OK',playableInBackground:false},adPlacements:[{}],streamingData:{formats:[{itag:18}]}});
  const get=background_playback=>JSON.parse(output(invoke('playback-response',{url:api('player'),body,args:{background_playback},headers:{'Content-Type':'application/json'}}),body));
  const on=get(true),off=get(false);
  assert.equal(on.adPlacements,undefined);assert.equal(off.adPlacements,undefined);
  assert.equal(on.playabilityStatus.playableInBackground,true);assert.equal(off.playabilityStatus.playableInBackground,false);
  assert.equal(on.streamingData.formats[0].itag,18);
});
test('existing playback request region selection is still applied',()=>{
  const run=invoke('playback-request',{url:api('player'),phase:'request',args:{playback_region:'JP'},
    requestBody:JSON.stringify({context:{client:{gl:'US'}},playbackContext:{contentPlaybackContext:{adPlaybackContext:{}}}}),
    requestHeaders:{'Content-Type':'application/json'}});
  assert.equal(JSON.parse(run.results[0].body).context.client.gl,'JP');
});
test('remote channel refresh keeps the existing asynchronous updater',()=>{
  const args={blocked_channels_url:'https://example.com/channels.txt'},store=new Map();
  const run=invoke('channels',{phase:'request',args,store,extra:{$request:undefined},
    http:(request,callback)=>callback(null,{status:200,headers:{'Content-Type':'text/plain'}},'UCabcdefghijklmnopqrstuv\n@blocked')});
  assert.equal(run.results.length,1);assert.equal(run.calls.length,1);
  assert.equal(JSON.parse(store.get('ytads.channels.remote.v1')).text,'UCabcdefghijklmnopqrstuv @blocked');
});
for(const [lane,old,endpoint,phase,body]of [
  ['playback-response','response','player','response',player()],
  ['playback-response','response','reel/reel_watch_sequence','response',binary(2,binary(1,binary(139608561,binary(16,integer(1,1)))))],
  ['playback-request','request','player','request',undefined],
  ['config','response','config','response',opaque],
  ['config-request','request','log_event','request',undefined]
])test('preserved legacy behavior: '+lane+' '+endpoint,()=>{
  const input={url:api(endpoint),phase,body,requestBody:JSON.stringify({context:{client:{gl:'US'}}}),args:{background_playback:true,playback_region:'JP'}};
  const before=invoke(old,input),after=invoke(lane,input);
  assert.equal(after.results.length,1);assert.deepEqual(JSON.parse(JSON.stringify(after.results)),JSON.parse(JSON.stringify(before.results)));
});
for(const body of [new Uint8Array([255]),new Uint8Array(8388609)])test('invalid or oversized API bodies safely pass through',()=>{
  const run=invoke('feed',{body});assert.equal(run.results.length,1);assert.deepEqual(Object.keys(run.results[0]),[]);
});
test('build outputs match manifest and keep unrelated handlers out of each response lane',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../build-manifest.json',import.meta.url),'utf8'));
  for(const [name,entry]of Object.entries(manifest)){
    const data=await readFile(new URL('../'+name,import.meta.url));
    assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256);
  }
  assert.ok(!manifest['caption.min.js'].modules.some(path=>/legacy\/|protocol\.mjs/.test(path)));
  assert.ok(!manifest['playback-response.min.js'].modules.some(path=>/vendor\/|YouTubeFeed|YouTubeLogger/.test(path)));
  assert.ok(!manifest['feed.min.js'].modules.some(path=>/captions\.mjs|YouTubePlayback|YouTubeLogger/.test(path)));
});
