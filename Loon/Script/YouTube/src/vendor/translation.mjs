// Copyright 2026 Horatio Xu. MIT. One bounded, position-checked fallback batch.
import {utf8,utf8Length,fromUtf8,asBytes,safeJson,MAX_CAPTION,getHeader} from './data.mjs';
import {unpackHttp} from './body.mjs';
import {formatTranslation} from './caption-layout.mjs';
export const TRANSLATION_BACKOFF='Horatio.YouTubeClean.translation.backoff.v1';
const compact=s=>s.replace(/\s+/g,' ').trim();
function language(value,target=false){
 const name=String(value||'').toLowerCase();if(['zh-hant','zh-tw','zh-hk'].includes(name))return'zh-TW';if(['zh-hans','zh-cn','zh-sg'].includes(name))return'zh-CN';
 return /^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(name)?name.split('-')[0]:(target?'zh-CN':'auto');
}
export function translationBatch(timeline,source,target){
 const texts=[],indices=new Map();let total=0;
 for(const cue of timeline.cues){const text=compact(cue.words);if(!text||indices.has(text))continue;
  total+=utf8Length(text);if(text.length>4000||total>48000||texts.length>=2048)throw Error('translation input limit');indices.set(text,texts.length);texts.push(text);
 }
 if(!texts.length)throw Error('translation empty');
 const body=texts.map(text=>'q='+encodeURIComponent(text)).join('&');if(body.length>192000)throw Error('translation input limit');
 return {texts,indices,request:{url:'https://translate.googleapis.com/translate_a/t?client=gtx&format=text&sl='+language(source)+'&tl='+language(target,true),headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Accept:'application/json','Accept-Encoding':'identity'},body}};
}
// Do not log response text or arbitrary headers. A 200 alone does not mean
// the provider returned the position-preserving array this request requires.
function decodeReply(response,count,d){
 const fail=reason=>{d.captionFallbackReason=reason;return null;};
 const header=getHeader(response.headers,'Content-Encoding').trim().toLowerCase();
 d.captionFallbackEncoding=['gzip','br','deflate','identity'].includes(header)?header:header?'other':'none';
 const type=getHeader(response.headers,'Content-Type').split(';')[0].trim().toLowerCase();
 d.captionFallbackContentType=['application/json','text/html','text/plain'].includes(type)?type:type?'other':'none';
 let raw;try{raw=asBytes(response.body);}catch{return fail('body-representation');}
 d.captionFallbackResponseBytes=raw.length;if(raw.length>MAX_CAPTION)return fail('response-limit');
 let bytes;try{bytes=unpackHttp(raw,MAX_CAPTION).bytes;}catch{return fail('invalid-compression');}
 let text=fromUtf8(bytes,true);
 if(text===null)return fail(['br','deflate','other'].includes(d.captionFallbackEncoding)?'unsupported-encoding':'invalid-utf8');
 text=text.trimStart();
 // Strip only the known JSON protection line; never search through HTML or
 // arbitrary text for an array and mistake it for a translation response.
 text=text.replace(/^\)\]\}'(?:\r\n|\n)/,'').trimStart();
 if(text.startsWith('<'))return fail('html-response');
 let answers;try{answers=safeJson(text);}catch{return fail('invalid-json');}
 d.captionFallbackShape=Array.isArray(answers)?'array':answers===null?'null':typeof answers;
 if(!Array.isArray(answers))return fail('unexpected-shape');
 d.captionFallbackResponseItems=answers.length;
 if(answers.length!==count)return fail('item-count');
 let empty=0;const decoded=[];
 for(let answer of answers){
  if(Array.isArray(answer)&&answer.length===2&&typeof answer[1]==='string'&&/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(answer[1]))answer=answer[0];
  if(answer===null)answer='';
  if(typeof answer!=='string'||answer.length>16000)return fail('invalid-entry');
  const value=compact(answer);if(!value)empty++;decoded.push(value);
 }
 d.captionFallbackEmptyItems=empty;return decoded;
}
function pause(io){try{const x=io.store?.read(TRANSLATION_BACKOFF),now=Date.now();return Number.isFinite(x?.until)&&x.until>now&&x.until<=now+301000?x.until:0;}catch{return 0;}}
function throttle(io,headers){
 const value=getHeader(headers,'Retry-After');let seconds=/^\d+$/.test(value)?Number(value):(Date.parse(value)-Date.now())/1000;if(!Number.isFinite(seconds))seconds=60;
 const until=Math.max(pause(io),Date.now()+Math.min(300,Math.max(30,seconds))*1000);try{io.store?.write(TRANSLATION_BACKOFF,{until});}catch{}return until;
}
export async function googleFallback(io,settings,timeline,source,diagnostic,deadline){
 const d=diagnostic;if(!settings.fallback||typeof io.translate!=='function')return null;
 const paused=pause(io);if(paused){d.captionFallbackReason='cooldown';d.captionFallbackRetryAfterSeconds=Math.ceil((paused-Date.now())/1000);return null;}
 if(deadline-Date.now()<250){d.captionFallbackReason='deadline';return null;}
 let batch;try{batch=translationBatch(timeline,source,settings.target);}catch{d.captionFallbackReason='input-limit';return null;}
 d.captionFallbackRequestItems=batch.texts.length;
 const timeout=Math.min(4000,deadline-Date.now());if(timeout<250){d.captionFallbackReason='deadline';return null;}
 let response;try{response=await io.translate(batch.request,timeout);}catch(error){d.captionFallbackReason=error?.message==='caption timeout'?'timeout':error?.message==='caption size'?'response-limit':'connection';return null;}
 if(Date.now()>deadline){d.captionFallbackReason='deadline';return null;}
 const status=Number(response?.status);if(Number.isInteger(status)&&status>=100&&status<=599)d.captionFallbackStatus=status;
 if(status!==200){d.captionFallbackReason='http-status';if(status===429)d.captionFallbackRetryAfterSeconds=Math.ceil((throttle(io,response.headers)-Date.now())/1000);return null;}
 const answers=decodeReply(response,batch.texts.length,d);if(!answers)return null;
 d.captionFallbackTranslatedItems=answers.filter((text,index)=>text&&text!==batch.texts[index]).length;
 const replacements=new Map();
 for(const cue of timeline.cues){const original=compact(cue.words),translated=answers[batch.indices.get(original)];if(!translated||translated===original)continue;const formatted=settings.layout?formatTranslation(translated,settings.target):translated;replacements.set(cue,settings.dual?cue.words.trim()+'\n'+formatted:formatted);}
 if(!replacements.size){d.captionFallbackReason='unchanged';return null;}
 const body=utf8(timeline.render(replacements));if(body.length>MAX_CAPTION){d.captionFallbackReason='output-limit';return null;}
 d.captionProvider='google';d.captionFallbackItems=batch.texts.length;d.captionFallbackReason='translated';return body;
}
