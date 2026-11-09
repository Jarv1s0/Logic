// Copyright 2026 Horatio Xu. MIT. Native-first subtitles and bounded recovery.
import {asBytes,fromUtf8,utf8,param,changeParam,getHeader,route,MAX_CAPTION} from './data.mjs';
import {unpackHttp} from './body.mjs';
import {readTimeline,mergeTimelines,reflowTimeline} from './timeline.mjs';
import {googleFallback} from './translation.mjs';
export const CAPTION_BACKOFF='Horatio.YouTubeClean.captions.backoff.v1';
const MAX_BACKOFF=300000;
const normalized=language=>({'zh-tw':'zh-hant','zh-hk':'zh-hant','zh-cn':'zh-hans','zh-sg':'zh-hans'})[String(language).toLowerCase()]||String(language).toLowerCase();
function cooldown(io){
  try{const value=io.store?.read(CAPTION_BACKOFF),now=Date.now();
    if(value&&Number.isFinite(value.until)&&value.until>now&&value.until<=now+MAX_BACKOFF+1000)return{until:value.until,sourceBlocked:value.sourceBlocked===true};
  }catch{}return null;
}
function backoff(io,headers,sourceBlocked=false){
  const retry=getHeader(headers,'Retry-After');let seconds=/^\d+$/.test(retry)?Number(retry):(Date.parse(retry)-Date.now())/1000;
  if(!Number.isFinite(seconds))seconds=60;const previous=cooldown(io);
  const until=Math.max(previous?.until||0,Date.now()+Math.max(30,Math.min(seconds,300))*1000);
  try{io.store?.write(CAPTION_BACKOFF,{until,sourceBlocked:sourceBlocked||previous?.sourceBlocked===true});}catch{}
  return until;
}
function remaining(d,until){d.captionRetryAfterSeconds=Math.max(0,Math.ceil((until-Date.now())/1000));}
function companionUrl(url,target){
  if(url.includes('#')||['sparams','lsparams'].some(key=>param(url,key).split(',').includes('tlang')))return null;
  const next=changeParam(url,'tlang',target);return route(next)?.kind==='caption'?next:null;
}
function timeline(bytes,renderable=true){return readTimeline(fromUtf8(unpackHttp(bytes,MAX_CAPTION).bytes),{renderable});}
function contentType(format){return format==='json3'?'application/json; charset=utf-8':format==='vtt'?'text/vtt; charset=utf-8':'application/xml; charset=utf-8';}
function headers(io,internal){
  const out={[internal]:'1',Accept:'*/*'};
  for(const name of ['User-Agent','Accept-Language']){const value=getHeader(io.requestHeaders,name);if(value&&value.length<=1024&&!/[\r\n]/.test(value))out[name]=value;}
  return out;
}
export async function handleCaption(io,settings,diagnostic,internal){
  const d=diagnostic,deadline=Date.now()+6500;d.format='caption';d.captionLayout=settings.layout?'balanced':'off';
  if(!settings.translate){d.reason='caption-disabled';return null;}
  const status=Number(io.status),selected=param(io.url,'tlang'),source=param(io.url,'lang'),target=normalized(settings.target);
  const translated=!!selected;
  d.captionRequest=translated?'translated':'original';d.captionTarget=settings.target;
  if(/^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(source))d.captionSource=source;
  const raw=asBytes(io.body??'');d.bytes=raw.length;d.outputBytes=raw.length;
  if(raw.length>MAX_CAPTION){d.bypass=true;d.reason='body-too-large';return null;}
  const targetSelected=translated&&normalized(selected)===target;
  // Recover a failed old synthetic/native translated URL only from a validated
  // original transcript. Never manufacture a successful empty/error response.
  const recovering=status!==200&&targetSelected&&io.captionRecovery!==false;
  if(status!==200){
    d.bypass=true;d.reason='http-status';
    const previous=cooldown(io);if(status===429)remaining(d,backoff(io,io.responseHeaders,!translated));
    if(!recovering||previous?.sourceBlocked){if(previous?.sourceBlocked)d.reason='caption-cooldown';return null;}
  }
  if(translated&&!targetSelected){d.reason='caption-other-target';return null;}
  if(!translated&&normalized(source)===target){d.reason='caption-already-target';return null;}
  let base;
  async function backup(timeline,recovered=false){
    if(translated&&!recovered)return null;
    const body=await googleFallback(io,settings,timeline,source,d,deadline);if(!body)return null;
    d.changed=true;d.bypass=false;d.reason='caption-fallback-translated';d.outputBytes=body.length;d.captionMode=settings.dual?'bilingual':'translation';d.captionOutputStatus=recovered?200:status;
    return recovered?{body,status:200,headers:{'Content-Type':contentType(timeline.format),'Retry-After':null}}:{body};
  }
  if(!recovering){
    if(!raw.length){d.bypass=true;d.reason='empty-body';return null;}
    d.compression=raw[0]===31&&raw[1]===139?'gzip':'none';
    try{base=timeline(raw);}catch{d.bypass=true;d.reason='caption-format-unsupported';return null;}
    d.captionFormat=base.format;
    if(!base.cues.length){d.reason='caption-empty';return null;}
    if(targetSelected&&!settings.dual){
      d.reason='caption-target-only';const formatted=settings.layout?reflowTimeline(base,settings.target):null;if(!formatted)return null;
      const body=utf8(formatted);if(body.length>MAX_CAPTION){d.reason='caption-output-too-large';return null;}
      d.changed=true;d.outputBytes=body.length;d.reason='caption-layout';d.captionMode='translation';return{body};
    }
    const paused=!translated&&cooldown(io);if(paused){remaining(d,paused.until);d.reason='caption-cooldown';return await backup(base);}
  }
  const url=companionUrl(io.url,translated?null:settings.target);
  if(!url){d.reason='caption-signed-target';return null;}
  let response;
  try{response=await io.download(url,headers(io,internal));}catch(error){
    d.reason=error?.message==='caption timeout'?'caption-timeout':error?.message==='caption size'?'caption-download-too-large':'caption-download-failed';return base?await backup(base):null;
  }
  const downloadStatus=Number(response.status);
  if(Number.isInteger(downloadStatus)&&downloadStatus>=100&&downloadStatus<=599)d.captionDownloadStatus=downloadStatus;
  if(downloadStatus!==200){
    if(downloadStatus===429)remaining(d,backoff(io,response.headers,translated));
    d.reason=recovering?'caption-fallback-failed':downloadStatus===429?'caption-rate-limited':'caption-download-http-status';return base?await backup(base):null;
  }
  let companion,bytes;
  try{
    bytes=asBytes(response.body);d.captionDownloadBytes=bytes.length;
    if(bytes.length>MAX_CAPTION){d.reason='caption-download-too-large';return base?await backup(base):null;}
    if(!bytes.length){d.reason='caption-download-empty';return base?await backup(base):null;}
    companion=timeline(bytes,recovering);if(!companion.cues.length){d.reason='caption-download-empty';return base?await backup(base):null;}
  }catch{d.reason='caption-download-invalid';return base?await backup(base):null;}
  let body;
  if(recovering){
    const translatedBody=await backup(companion,true);if(translatedBody)return translatedBody;
    body=unpackHttp(bytes,MAX_CAPTION).bytes;d.reason='caption-fallback-original';d.captionMode='original-fallback';d.captionFormat=companion.format;
  }else{
    const merged=mergeTimelines(base,companion,{baseOriginal:!translated,dual:settings.dual,layout:settings.layout,language:settings.target});
    if(!merged){d.reason='caption-no-alignment';return await backup(base);}body=utf8(merged);d.reason='modified';d.captionProvider='youtube';d.captionMode=settings.dual?'bilingual':'translation';
  }
  if(body.length>MAX_CAPTION){d.reason='caption-output-too-large';return null;}
  d.changed=true;d.bypass=false;d.outputBytes=body.length;d.captionOutputStatus=recovering?200:status;
  return recovering?{body,status:200,headers:{'Content-Type':contentType(companion.format),'Retry-After':null}}:{body};
}
