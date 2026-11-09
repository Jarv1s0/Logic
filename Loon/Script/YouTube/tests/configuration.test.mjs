import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {settings} from '../src/settings.mjs';
const plugin=await readFile(new URL('../../../YouTube.lpx',import.meta.url),'utf8');
const scriptSection=plugin.split('[Script]')[1].split('[Mitm]')[0];
const lines=scriptSection.split('\n').filter(line=>/^(request|response) if /.test(line));
const keys=new Set([...plugin.matchAll(/^(\w+) = (?:switch|select|input),/gm)].map(match=>match[1]));
function rulesFor(phase,url,args={}) {
  const rules=[];
  for(const line of lines){
    if(!line.startsWith(phase+' '))continue;
    // Read the URL guard independently of the following Loon conditions.
    const guard=line.match(/\$\{url\} ~= \/(.+?)\/([i]*)(?: then | &&)/);
    assert.ok(guard,line);
    if(!new RegExp(guard[1],guard[2]).test(url))continue;
    if(line.includes('enable=${translation_enabled}')&&!args.translation_enabled)continue;
    if(line.includes('enable=${log_enabled}')&&!args.log_enabled)continue;
    if(line.includes('${log_enabled} == true')&&!args.log_enabled)continue;
    if(line.includes('${quality_research} == true')&&!args.quality_research)continue;
    if(line.includes('${media_capture_mode} == "full"')&&args.media_capture_mode!=='full')continue;
    rules.push(line.match(/\/([\w-]+)\.min\.js/)[1]);
  }
  return rules;
}
test('all configured scripts and parameter keys exist; old monolithic scripts are not referenced',()=>{
  for(const line of scriptSection.split('\n').filter(line=>line.includes('then script('))){
    const name=line.match(/\/([\w-]+)\.min\.js/)[1];
    assert.ok(existsSync(new URL('../'+name+'.min.js',import.meta.url)),name);
    assert.ok(!['request','response'].includes(name));
    for(const match of line.matchAll(/\$\{([a-z_]+)\}/g))assert.ok(keys.has(match[1])||['url','request'].includes(match[1]),match[1]);
  }
});
test('API requests and responses each select the intended single lane across all configured hosts',()=>{
  const map={browse:['feed-request','feed'],next:['feed-request','feed'],search:['feed-request','feed'],
    guide:['feed-request','feed'],'navigation/resolve_url':['feed-request','feed'],
    player:['playback-request','playback-response'],get_watch:['playback-request','playback-response'],
    'player/ad_break':['playback-request',null],config:[null,'config'],log_event:['config-request','config'],
    'reel/reel_watch_sequence':['logger','playback-response']};
  for(const host of ['youtubei.googleapis.com','youtubei-att.googleapis.com','youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'])
    for(const [endpoint,expected]of Object.entries(map))for(const query of ['', '?key=test']){
      const url='https://'+host+'/youtubei/v1/'+endpoint+query;
      for(const [i,phase]of ['request','response'].entries()){
        // Existing config/log_event guards intentionally do not include music.
        const want=host==='music.youtube.com'&&['config','log_event'].includes(endpoint)?null:expected[i];
        assert.deepEqual(rulesFor(phase,url,{log_enabled:true}),want?[want]:[],phase+' '+url);
      }
    }
});
test('subtitle response is the sole translation lane and translation stays disabled by default',()=>{
  for(const host of ['youtube.com','www.youtube.com','m.youtube.com']){
    const url='https://'+host+'/api/timedtext?lang=en';
    assert.deepEqual(rulesFor('request',url,{translation_enabled:true}),[]);
    assert.deepEqual(rulesFor('response',url,{translation_enabled:true}),['caption']);
    assert.deepEqual(rulesFor('response',url),[]);
  }
  const s=settings({});assert.equal(s.translate,false);assert.equal(s.hideCreate,false);assert.equal(s.hideShorts,false);assert.equal(s.fallback,false);
});
test('normal media never buffers response bodies with logging disabled; full capture precedes headers',()=>{
  for(const endpoint of ['videoplayback','initplayback']){
    const url='https://rr1.googlevideo.com/'+endpoint+'?id=test';
    assert.deepEqual(rulesFor('response',url),[]);
    assert.deepEqual(rulesFor('response',url,{log_enabled:true,media_capture_mode:'headers'}),['logger']);
    // Loon runs the first matching script, so the intentional full/header pair
    // must remain ordered with full first, as in the previous plugin.
    const matches=lines.filter(line=>line.startsWith('response ')&&line.includes('googlevideo')&&line.includes('logger.min.js'));
    assert.ok(matches[0].includes('requires_body=true'));assert.ok(matches[1].includes('requires_body=false'));
  }
  assert.match(plugin,/then reject_video\(200\)/);
});
