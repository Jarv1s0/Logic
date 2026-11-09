// Copyright 2026 Horatio Xu. MIT.
export const VERSION='1.2.12', MAX_BODY=8388608, MAX_CAPTION=1048576;
export function asBytes(value){
  if(typeof value==='string')return utf8(value);
  if(value instanceof Uint8Array)return value;
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  throw Error('body representation');
}
export function utf8Length(value){
  const text=String(value);let size=0;
  for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);
    if(n<128)size++;else if(n<2048)size+=2;
    else if(n>=0xd800&&n<=0xdbff&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){size+=4;i++;}
    else size+=3;
  }return size;
}
export function utf8(value){
  const text=String(value),out=new Uint8Array(utf8Length(text));let at=0;
  for(let i=0;i<text.length;i++){let n=text.charCodeAt(i);
    if(n>=0xd800&&n<=0xdbff&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff)n=0x10000+((n-0xd800)<<10)+(text.charCodeAt(++i)-0xdc00);
    else if(n>=0xd800&&n<=0xdfff)n=0xfffd;
    if(n<128)out[at++]=n;
    else if(n<2048){out[at++]=0xc0|(n>>6);out[at++]=0x80|(n&63);}
    else if(n<65536){out[at++]=0xe0|(n>>12);out[at++]=0x80|((n>>6)&63);out[at++]=0x80|(n&63);}
    else{out[at++]=0xf0|(n>>18);out[at++]=0x80|((n>>12)&63);out[at++]=0x80|((n>>6)&63);out[at++]=0x80|(n&63);}
  }return out;
}
// Synchronous only: no scratch view escapes and each returned string is copied.
// Reuse at most 4096 UTF-16 units instead of allocating arrays for every chunk.
let textScratch;
export function fromUtf8(data,strict=false){
  data=asBytes(data);const chunk=textScratch||(textScratch=new Uint16Array(4096));let output='',used=0;
  for(let at=0;at<data.length;){const b=data[at++];let size,n,min;
    if(b<128){size=0;n=b;min=0;}else if(b>=194&&b<224){size=1;n=b&31;min=128;}else if(b>=224&&b<240){size=2;n=b&15;min=2048;}else if(b>=240&&b<=244){size=3;n=b&7;min=65536;}else{if(strict)return null;size=0;n=0xfffd;min=0;}
    let valid=at+size<=data.length;for(let i=0;i<size&&valid;i++){const next=data[at+i];if((next&192)!==128)valid=false;else n=(n<<6)|(next&63);}
    if(!valid||n<min||n>0x10ffff||(n>=0xd800&&n<=0xdfff)){if(strict)return null;n=0xfffd;}else at+=size;
    if(used+(n>65535?2:1)>chunk.length){output+=String.fromCharCode.apply(null,chunk.subarray(0,used));used=0;}
    if(n>65535){n-=65536;chunk[used++]=0xd800+(n>>10);chunk[used++]=0xdc00+(n&1023);}else chunk[used++]=n;
  }return output+(used?String.fromCharCode.apply(null,chunk.subarray(0,used)):'');
}
// Equivalent to strict decoding plus the existing ASCII-control test, without
// constructing a title/signature string just to decide whether it is opaque.
export function isOpaqueText(data){
  if(!data.length)return false;
  for(let at=0;at<data.length;){const b=data[at++];let size,n,min;
    if(b<128){if(b<=8||b===11||b===12||b>=14&&b<=31)return false;continue;}
    if(b>=194&&b<224){size=1;n=b&31;min=128;}else if(b>=224&&b<240){size=2;n=b&15;min=2048;}else if(b>=240&&b<=244){size=3;n=b&7;min=65536;}else return false;
    if(at+size>data.length)return false;
    for(let i=0;i<size;i++){const next=data[at++];if((next&192)!==128)return false;n=(n<<6)|(next&63);}
    if(n<min||n>0x10ffff||n>=0xd800&&n<=0xdfff)return false;
  }return true;
}
export function getHeader(headers,name){
  if(headers&&typeof headers.get==='function')return String(headers.get(name)||'');
  for(const key of Object.keys(headers||{}))if(key.toLowerCase()===name.toLowerCase())return String(headers[key]);return '';
}
export function finalizeHeaders(headers,overrides={}){
  const obsolete=new Set(['content-length','content-encoding','etag','last-modified','content-md5','digest','cache-control']);
  if(typeof headers?.delete==='function'){for(const name of obsolete)headers.delete(name);for(const [k,v]of Object.entries(overrides))if(v==null)headers.delete(k);else headers.set(k,v);headers.set('Cache-Control','no-store');headers.set('X-YouTubeClean',VERSION);return headers;}
  const replaced=new Set(Object.keys(overrides).map(k=>k.toLowerCase()));
  const result={};for(const [k,v]of Object.entries(headers||{}))if(!obsolete.has(k.toLowerCase())&&!replaced.has(k.toLowerCase()))result[k]=v;
  for(const [k,v]of Object.entries(overrides))if(v!=null)result[k]=v;
  result['Cache-Control']='no-store';result['X-YouTubeClean']=VERSION;return result;
}
export function safeJson(source){
  let quoted=false,escaped=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;continue;}
    if(c==='-'||(c>='0'&&c<='9')){const match=/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(i));if(match){const n=Number(match[0]);if(!Number.isFinite(n)||(Number.isInteger(n)&&!Number.isSafeInteger(n)))throw Error('JSON precision');i+=match[0].length-1;}}
  }return JSON.parse(source);
}
function unquote(s){try{return decodeURIComponent(s.replace(/\+/g,' '));}catch{return s;}}
export function param(url,name){const q=url.indexOf('?');if(q<0)return '';for(const part of url.slice(q+1).split('&')){const at=part.indexOf('=');if(unquote(at<0?part:part.slice(0,at))===name)return at<0?'':unquote(part.slice(at+1));}return '';}
export function changeParam(url,name,value){
  const q=url.indexOf('?'),base=q<0?url:url.slice(0,q),items=q<0?[]:url.slice(q+1).split('&').filter(Boolean);
  const kept=items.filter(p=>unquote(p.split('=')[0])!==name);if(value!==null)kept.push(encodeURIComponent(name)+'='+encodeURIComponent(value));
  return base+(kept.length?'?'+kept.join('&'):'');
}
export class Settings{
  constructor(input={}){
    if(typeof input==='string'){if(input.trim().startsWith('{'))input=JSON.parse(input);else{const values={};for(const part of input.split('&')){const at=part.indexOf('=');if(at>0)values[unquote(part.slice(0,at))]=unquote(part.slice(at+1));}input=values;}}
    if(input==null)input={};
    if(typeof input!=='object'||Array.isArray(input))throw Error('settings representation');
    const flag=(name,initial)=>input[name]==null?initial:input[name]===true||input[name]===1||/^(?:true|1)$/i.test(String(input[name]));
    this.ads=flag('REMOVE_ADS',true);this.translate=flag('TRANSLATE_CAPTIONS',true);this.dual=flag('BILINGUAL',true);this.auto=flag('AUTO_CAPTIONS',true);
    this.fallback=flag('FALLBACK_TRANSLATION',true);this.layout=flag('CAPTION_LAYOUT',true);
    this.hideCreate=flag('HIDE_UPLOAD',true);this.hideShorts=flag('HIDE_SHORTS',false);
    this.deep=flag('DEEP_FILTER',true);this.debug=flag('DIAGNOSTICS',true);
    this.profile=['elements','deep','tcp'].includes(input.PROFILE)?input.PROFILE:(this.deep?'deep':'elements');
    const target=String(input.TARGET_LANGUAGE||'zh-Hans');this.target=({'zh-CN':'zh-Hans','zh-TW':'zh-Hant'})[target]||target;if(!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(this.target))this.target='zh-Hans';
  }
  get active(){return this.ads||this.translate||this.hideCreate||this.hideShorts;}
}
export const API_HOSTS='(?:youtubei(?:-att)?\\.googleapis\\.com|(?:www|m)\\.youtube\\.com)';
export const API_REGEX='^https://'+API_HOSTS+'(?::443)?/youtubei/v1/(?:player(?:/ad_break)?|browse|next|search|guide|navigation/resolve_url|reel/(?:reel_watch_sequence|reel_item_watch)|get_watch|config|log_event)(?:\\?.*)?$';
export const CAPTION_REGEX='^https://(?:(?:www|m)\\.)?youtube\\.com(?::443)?/api/timedtext(?:\\?.*)?$';
export const UMP_REGEX='^https://[a-zA-Z0-9-]+\\.googlevideo\\.com(?::443)?/initplayback(?:\\?.*)?$';
export function route(url){
  if(new RegExp(API_REGEX).test(url))return {kind:'api',name:url.split('?')[0].replace(/^.*\/youtubei\/v1\//,'')};
  if(new RegExp(CAPTION_REGEX).test(url))return {kind:'caption'};
  if(new RegExp(UMP_REGEX).test(url))return {kind:'ump'};return null;
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function b64(data){let s='';for(let i=0;i<data.length;i+=3){const n=(data[i]<<16)|((data[i+1]||0)<<8)|(data[i+2]||0);s+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<data.length?alphabet[(n>>>6)&63]:'=')+(i+2<data.length?alphabet[n&63]:'=');}return s;}
export function unb64(s){if(typeof s!=='string'||s.length%4||!/^[\w+/]*={0,2}$/.test(s))throw Error('base64');const out=[];let acc=0,bits=0;for(const c of s.replace(/=+$/,'')){const n=alphabet.indexOf(c);if(n<0)throw Error('base64');acc=(acc<<6)|n;bits+=6;if(bits>=8){bits-=8;out.push((acc>>>bits)&255);}}return new Uint8Array(out);}
