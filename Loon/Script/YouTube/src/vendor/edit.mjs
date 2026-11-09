// Copyright 2026 Horatio Xu. MIT. YouTube policies and edits are implemented here.
import {decodeMessage,nested,findField,join,withPayload,makeBytes,makeInt,replaceAll,readPacked,same,planMessage,materializeMessage,changedMessage} from './wire.mjs';
import {fromUtf8,isOpaqueText,CAPTION_REGEX,unb64} from './data.mjs';
import {graph,rendererAds} from './protocol.mjs';
import {editElementRenderer,deepCardAd,jsonElementAd} from './elements.mjs';
import {FEED_ENVELOPE,editFeedEnvelope} from './feed-envelope.mjs';
const NS='.youtube.api.innertube.';
const ROOT={player:'PlayerResponse',browse:'BrowseResponse',next:'WatchNextResponse',search:'SearchResponse',guide:'GuideResponse',get_watch:'WatchBatch',config:'ConfigResponse',log_event:'ConfigResponse','player/ad_break':'AdBreakResponse','navigation/resolve_url':'ResolveUrlResponse','reel/reel_item_watch':'ReelItemWatchResponse','reel/reel_watch_sequence':'ReelSequenceResponse'};
const extra={
  // These wrappers are referenced but not defined by the upstream partial schema.
  // Field paths were verified against native iOS browse + continuation responses.
  [NS+'BrowseResponse']:{...graph[NS+'BrowseResponse'],10:NS+'ContinuationSupportedRenderers'},
  [NS+'BrowseTabSupportedRenderers']:{...graph[NS+'BrowseTabSupportedRenderers'],58174010:NS+'TabRenderer'},
  [NS+'TabRenderer']:{4:NS+'Renderer'},
  [NS+'SectionListSupportedRenderers']:{...graph[NS+'SectionListSupportedRenderers'],50195462:NS+'ItemSectionRenderer',153515154:NS+'ElementRenderer'},
  [NS+'SectionListWithoutPreviewSupportedRenderers']:{...graph[NS+'SectionListWithoutPreviewSupportedRenderers'],50195462:NS+'ItemSectionRenderer'},
  [NS+'ContinuationSupportedRenderers']:{49399797:NS+'SectionListRenderer',51779803:NS+'SectionListWithoutPreviewRenderer'},
  [NS+'ItemSectionRenderer']:{1:NS+'Renderer'},
  [NS+'PlayerResponse']:{...graph[NS+'PlayerResponse'],10:NS+'Captions'},
  [NS+'Captions']:{51621377:NS+'CaptionList'},
  [NS+'GuideResponse']:{1:NS+'ResponseContext',4:NS+'Renderer',6:NS+'Renderer'},
  [NS+'Renderer']:{...graph[NS+'Renderer'],117866661:NS+'PivotBar'},
  [NS+'PivotBar']:{1:NS+'PivotItemWrapper'},
  [NS+'WatchBatch']:{1:NS+'GetWatchResponse',2:NS+'PlayerResponse',3:NS+'WatchNextResponse'},
  [NS+'AdBreakResponse']:{1:NS+'ResponseContext',777:NS+'FrameworkUpdateTransport'},
  [NS+'ReelSequenceResponse']:{1:NS+'ReelEntry'},
  [NS+'ReelEntry']:{1:NS+'Command'}
};
const PLAYER_ADS=new Set([7,23,25,27,38,44,45,48,68,69]);
const BREAK_ADS=new Set([2,3,6,9,10]);
const creation=new Set(['FEuploads','FEupload','FEcreate','creation_entry']);
const shortNav=new Set(['FEshorts']);
export function navIdentity(raw,depth=0){
  if(depth>7)return '';
  for(const f of decodeMessage(raw)){
    if(f.wire!==2)continue;
    const word=f.payload.length<=32?fromUtf8(f.payload,true):null;
    if(word&&(creation.has(word)||shortNav.has(word)))return word;
    // Navigation endpoint/renderer messages; never inspect arbitrary strings or tracking blobs.
    if(isOpaqueText(f.payload))continue;
    try{const id=navIdentity(f.payload,depth+1);if(id)return id;}catch{}
  }return '';
}
function hidden(id,settings){return settings.hideCreate&&creation.has(id)||settings.hideShorts&&shortNav.has(id);}
// Keep every native track and signed URL intact. AUTO_CAPTIONS only fills a
// missing/invalid default with an existing eligible track in that audio group.
function captionList(raw,s){
  if(!s.translate||!s.auto)return raw;
  const fields=decodeMessage(raw),tracks=fields.filter(f=>f.no===1&&f.wire===2);
  if(!tracks.length||tracks.length>128)return raw;
  const eligible=tracks.map(f=>{const fs=decodeMessage(f.payload),url=fromUtf8(findField(fs,1)?.payload||new Uint8Array(),true)||'';return findField(fs,7)?.value===1n&&new RegExp(CAPTION_REGEX).test(url);});
  let changed=false;const out=fields.map(f=>{
    if(f.no!==2||f.wire!==2)return f.raw;
    const af=decodeMessage(f.payload),ids=af.filter(x=>x.no===2).flatMap(readPacked).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<tracks.length);
    const current=findField(af,3);if(current?.wire===0&&ids.includes(Number(current.value)))return f.raw;
    const chosen=ids.find(n=>eligible[n]);if(chosen===undefined)return f.raw;
    changed=true;return withPayload(f,replaceAll(af,3,[makeInt(3,chosen)]));
  });return changed?join(out):raw;
}

export function editBinary(raw,endpoint,settings,onKeys,trace){
  let type=ROOT[endpoint];if(!type)return raw;
  if(endpoint==='get_watch'){
    const direct=decodeMessage(raw).some(f=>(f.no===2||f.no===3)&&f.wire===2);
    if(direct)type='GetWatchResponse';
  }
  const state={remaining:70000,depth:0,onKeys,trace};
  return materializeMessage(visit(raw,NS+type,settings,state));
}
export function editWatchPart(raw,settings,onKeys,trace){return materializeMessage(visit(raw,NS+'GetWatchResponse',settings,{remaining:70000,depth:0,onKeys,trace}));}
function visit(raw,type,s,state,feedCard=false){
  if(state.depth>48)throw Error('message depth');
  const fields=decodeMessage(raw);state.remaining-=fields.length;if(state.remaining<0)throw Error('message count');
  if(state.trace&&state.depth===0)state.trace.rootFields=fields.slice(0,16).map(f=>f.no);
  if(feedCard&&state.trace)state.trace.feedCards=(state.trace.feedCards||0)+1;
  const feedEnvelope=feedCard&&fields.some(f=>f.no===FEED_ENVELOPE&&f.wire===2);
  // A new wrapper may contain an entire mixed feed; never discard it because
  // one descendant is an advertisement. Edit validated entries individually.
  if(feedCard&&!feedEnvelope&&deepCardAd(raw,s,state.trace)){if(state.trace)state.trace.removed++;return new Uint8Array();}
  if(type===NS+'ElementRenderer')return editElementRenderer(raw,s,state.trace);
  if(type===NS+'OnesieHotConfig'&&state.onKeys){
    const key=findField(fields,1),encrypted=findField(fields,2),expiry=findField(fields,3);
    if(key?.payload?.length===32&&encrypted?.payload?.length)state.onKeys({key:key.payload,encrypted:encrypted.payload,ttl:Number(expiry?.value||3600n)});
  }
  if(type===NS+'CaptionList')return captionList(raw,s);
  const edges=extra[type]||graph[type]||{};let edits=null,lostContent=false,keptContent=false;
  const change=(field,payload=null)=>(edits??=[]).push({field,payload});
  for(const f of fields){
    if(type===NS+'GlobalConfigGroup'&&state.onKeys&&(f.no===3||f.no===7)&&f.wire===2){
      // The documented hot-config field can contain either serialized base64url or raw protobuf.
      try{
        const value=fromUtf8(f.payload,true);let hot=f.payload;
        if(value&&/^[A-Za-z0-9_+/=-]+$/.test(value)){let encoded=value.replace(/-/g,'+').replace(/_/g,'/');while(encoded.length%4)encoded+='=';hot=unb64(encoded);}
        state.depth++;try{visit(hot,NS+'HotConfigGroup',s,state);}finally{state.depth--;}
      }catch{}
    }
    if(s.ads&&((type===NS+'PlayerResponse'&&PLAYER_ADS.has(f.no))||(type===NS+'AdBreakResponse'&&BREAK_ADS.has(f.no)))){change(f);if(state.trace)state.trace.removed++;continue;}
    if(s.ads&&f.wire===2&&rendererAds[f.no]&&(edges[f.no]||/Renderer(?:s)?$/.test(type))){change(f);if(state.trace)state.trace.removed++;continue;}
    if(type===NS+'PivotBar'&&f.no===1&&f.wire===2&&(s.hideCreate||s.hideShorts)){
      if(hidden(navIdentity(f.payload),s)){change(f);continue;}
    }
    let payload=f.payload;
    if(feedEnvelope&&f.no===FEED_ENVELOPE&&f.wire===2){
      payload=editFeedEnvelope(f.payload,s,state.trace,state.feedEnvelopeBudget??={nodes:0,bytes:0},true);
      if(changedMessage(payload,f.payload)){change(f,payload);continue;}
    }
    if(f.wire===2&&edges[f.no]){
      const previousRemoved=state.trace?.removed;
      state.depth++;try{payload=visit(f.payload,edges[f.no],s,state,type===NS+'ItemSectionRenderer'&&f.no===1);}catch(error){
        // A changed/unknown sibling layout must not disable filtering in a valid feed.
        if(['message depth','message count','field count'].includes(error?.message))throw error;
        if(state.trace)state.trace.removed=previousRemoved;
        payload=f.payload;
      }finally{state.depth--;}
      if(changedMessage(payload,f.payload)){
        change(f,payload);if(!payload.length){if(f.no===1)lostContent=true;continue;}
        if(f.no===1)keptContent=true;continue;
      }
    }
    else if(feedCard&&f.wire===2&&f.no>=1000&&!(f.no===FEED_ENVELOPE&&s.ads&&s.deep)&&state.trace?.unknown&&state.trace.unknown.size<12)state.trace.unknown.add(f.no);
    if(f.no===1)keptContent=true;
  }
  // Drop an ad-only section including its tracking metadata, avoiding a blank card.
  if(s.ads&&type===NS+'ItemSectionRenderer'&&lostContent&&!keptContent)return new Uint8Array();
  return planMessage(raw,edits);
}

function camel(s){return s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());}
const AD_NAMES=new Set([...Object.values(rendererAds).map(camel),'adSlotRenderer','displayAdRenderer','inFeedAdLayoutRenderer','promotedSparklesWebRenderer','searchPyvRenderer','promotedVideoRenderer','compactPromotedVideoRenderer','compactPromotedItemRenderer','carouselAdRenderer','videoMastheadAdV3Renderer','videoMastheadAdRenderer','adPlacementRenderer','playerLegacyDesktopWatchAdsRenderer','adBreakServiceRenderer']);
const SLOT_ARRAYS=new Set(['adPlacements','adSlots','playerAds']);
const PLAYER_SIGNALS=new Set(['adParams','adNextParams','adBreakParams','adBreakHeartbeatParams','prefetchedPrerollAdBreakResponse','playerCompanionAd','instreamPlayerCtaAd','ssdaiAdsConfig']);
const NAV_CONTAINERS=new Set(['pivotBarRenderer','pivotBarViewModel','miniGuideRenderer','guideSectionRenderer']);
function jsonNavId(item){
  const stack=[item];let budget=120;
  while(stack.length&&budget-->0){const node=stack.pop();if(!node||typeof node!=='object')continue;
    for(const key of ['pivotIdentifier','browseId','identifier']){const v=node[key];if(typeof v==='string'&&(creation.has(v)||shortNav.has(v)))return v;}
    if(node.uploadEndpoint||node.creationEntryPoint||node.creationEndpoint)return 'FEuploads';
    const icon=node.icon?.iconType;if(['CREATION_ENTRY','UPLOAD','VIDEO_CALL'].includes(icon))return 'FEuploads';if(icon==='SHORTS')return 'FEshorts';
    for(const v of Object.values(node))if(v&&typeof v==='object')stack.push(v);
  }return '';
}
function adCard(item,s,trace,depth=0){
  if(!item||typeof item!=='object'||Array.isArray(item)||depth>4)return false;
  if(jsonElementAd(item,s,trace))return true;
  if(Object.keys(item).some(k=>AD_NAMES.has(k)))return true;
  for(const key of ['richItemRenderer','richSectionRenderer','content','contentViewModel'])if(adCard(item[key],s,trace,depth+1))return true;
  if(s.deep)for(const [key,value]of Object.entries(item))if(!['responseContext','frameworkUpdates','trackingParams','clickTrackingParams'].includes(key)&&adCard(value,s,trace,depth+1))return true;
  return false;
}
function jsonCaptionList(list,s){
  const tracks=list.captionTracks;if(!s.translate||!s.auto||!Array.isArray(tracks)||!tracks.length||tracks.length>128)return false;
  if(!Array.isArray(list.audioTracks))return false;let changed=false;
  for(const audio of list.audioTracks){
    if(!Array.isArray(audio.captionTrackIndices))continue;
    const ids=audio.captionTrackIndices.filter(n=>Number.isInteger(n)&&n>=0&&n<tracks.length);
    if(ids.includes(audio.defaultCaptionTrackIndex))continue;
    const chosen=ids.find(n=>tracks[n]?.isTranslatable===true&&new RegExp(CAPTION_REGEX).test(tracks[n]?.baseUrl||''));
    if(chosen!==undefined){audio.defaultCaptionTrackIndex=chosen;changed=true;}
  }return changed;
}

export function editJson(document,s,onKeys,trace,changes){
  let budget=70000;
  const mark=()=>{if(changes)changes.changed=true;};
  function traverse(node,nav=false,feed=false){
    if(--budget<0)throw Error('JSON item count');if(!node||typeof node!=='object')return;
    if(Array.isArray(node)){for(let i=node.length-1;i>=0;i--){const item=node[i];if(nav&&hidden(jsonNavId(item),s)){node.splice(i,1);mark();continue;}
      const adReel=item?.command?.reelWatchEndpoint?.adClientParams?.isAd===true||item?.reelWatchEndpoint?.adClientParams?.isAd===true;
      if(s.ads&&(feed&&adCard(item,s,trace)||adReel)){node.splice(i,1);mark();if(trace)trace.removed++;continue;}traverse(item,nav,feed);
    }return;}
    if(jsonCaptionList(node,s))mark();
    if(s.ads&&feed&&Array.isArray(node.childElements))for(let i=node.childElements.length-1;i>=0;i--){const child=node.childElements[i];if(jsonElementAd({newElement:child},s,trace)){node.childElements.splice(i,1);mark();if(trace)trace.removed++;}}
    if(onKeys&&node.onesieHotConfig)onKeys(node.onesieHotConfig);
    for(const key of Object.keys(node)){
      if(s.ads&&AD_NAMES.has(key)){delete node[key];mark();if(trace)trace.removed++;continue;}
      if(s.ads&&SLOT_ARRAYS.has(key)&&Array.isArray(node[key])){if(node[key].length){if(trace)trace.removed+=node[key].length;node[key]=[];mark();}continue;}
      if(s.ads&&PLAYER_SIGNALS.has(key)){delete node[key];mark();if(trace)trace.removed++;continue;}
      const nextFeed=['responseContext','frameworkUpdates','trackingParams','clickTrackingParams'].includes(key)?false:feed||['contents','content','items','continuationItems','continuationContents'].includes(key);
      traverse(node[key],nav||NAV_CONTAINERS.has(key),nextFeed);
    }
  }
  traverse(document);return document;
}
