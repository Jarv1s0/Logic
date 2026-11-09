// Copyright 2026 Horatio Xu. MIT. Independent subtitle parsing and interval alignment.
import {safeJson,MAX_CAPTION} from './data.mjs';
import {formatTranslation} from './caption-layout.mjs';
const compact=s=>String(s).replace(/\s+/g,' ').trim();
function entityText(source){
  return source.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(whole,entity)=>{
    if(entity[0]==='#'){const cp=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):whole;}
    return({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[entity.toLowerCase()]||whole;
  });
}
const escapeText=s=>s.replace(/[&<>]/g,c=>c==='&'?'&amp;':c==='<'?'&lt;':'&gt;');
const finiteTime=(n)=>Number.isFinite(n)&&n>=0&&n<1e10;
function stamp(source){const parts=source.replace(',','.').split(':').map(Number);if(parts.length<2||parts.some(n=>!Number.isFinite(n)))throw Error('caption time');return parts.reduce((n,v)=>n*60+v,0)*1000;}
export function readTimeline(source,{renderable=true}={}){
  if(source.length>MAX_CAPTION)throw Error('caption limit');
  const leading=source.trimStart();let cues=[],render,format;
  if(leading.startsWith('{')){
    format='json3';
    const doc=safeJson(source);if(!Array.isArray(doc.events))throw Error('caption JSON shape');
    const windows=new Map();
    for(let index=0;index<doc.events.length;index++){
      const event=doc.events[index];if(!Array.isArray(event.segs))continue;
      const words=event.segs.map(s=>typeof s.utf8==='string'?s.utf8:'').join('');if(!compact(words))continue;
      const start=Number(event.tStartMs),duration=Math.max(0,Number(event.dDurationMs)||0);if(!finiteTime(start)||!finiteTime(duration))throw Error('caption timing');
      const end=start+Math.max(duration,1),window=String(event.wWinId??0),previous=windows.get(window);
      if(event.aAppend&&previous&&start<=previous.end+5000){previous.words+=words;previous.end=Math.max(previous.end,end);if(renderable)previous.events.push(index);}
      else{const cue=renderable?{start,end,words,events:[index],event}:{start,end,words};cues.push(cue);windows.set(window,cue);}
    }
    if(renderable)render=(replacements,{textOnly=false}={})=>{
      for(const [cue,words]of replacements){cue.event.segs=[{utf8:words}];if(!textOnly){cue.event.dDurationMs=cue.end-cue.start;delete cue.event.aAppend;for(const index of cue.events.slice(1))doc.events[index].segs=[];}}
      return JSON.stringify(doc);
    };
  }else if(/^(?:<\?xml[^>]*>\s*)?<(?:timedtext|transcript)\b/.test(leading)){
    format=/<transcript\b/.test(leading)?'srv1':'srv3';
    if(/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(source))throw Error('caption XML declaration');
    for(const match of source.matchAll(/<(p|text)\b([^>]*)>([\s\S]*?)<\/\1>/g)){
      const attrs={};for(const a of match[2].matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[a[1]]=a[2]??a[3];
      const seconds=match[1]==='text',start=Number(seconds?attrs.start:attrs.t)*(seconds?1000:1),duration=Number(seconds?attrs.dur:attrs.d)*(seconds?1000:1);
      if(!finiteTime(start))throw Error('caption XML time');const words=entityText(match[3]);if(!compact(words))continue;
      const end=start+Math.max(Number.isFinite(duration)?duration:0,1);
      cues.push(renderable?{start,end,words,begin:match.index,endOffset:match.index+match[0].length,tag:match[1],attrs:match[2]}:{start,end,words});
    }
    if(renderable)render=replacements=>{
      if(!replacements.size)return source;
      const parts=[];let cursor=0;for(const [cue,words]of [...replacements].sort((a,b)=>a[0].begin-b[0].begin)){
        const payload=cue.tag==='p'?'<s>'+escapeText(words)+'</s>':escapeText(words);
        parts.push(source.slice(cursor,cue.begin),'<'+cue.tag+cue.attrs+'>'+payload+'</'+cue.tag+'>');cursor=cue.endOffset;
      }parts.push(source.slice(cursor));return parts.join('');
    };
  }else if(/^\uFEFF?WEBVTT(?:\s|$)/.test(source)){
    format='vtt';
    const newline=source.includes('\r\n')?'\r\n':'\n',blocks=source.replace(/\r\n/g,'\n').split('\n\n');
    for(let block=0;block<blocks.length;block++){
      const lines=blocks[block].split('\n');if(/^(?:WEBVTT|STYLE|NOTE|REGION)/.test(lines[0]))continue;
      const row=lines.findIndex(line=>line.includes('-->'));if(row<0)continue;
      const times=/^\s*([\d:.,]+)\s+-->\s+([\d:.,]+)/.exec(lines[row]);if(!times)throw Error('caption VTT time');
      const start=stamp(times[1]),end=stamp(times[2]);if(end<start)throw Error('caption VTT interval');
      const words=entityText(lines.slice(row+1).join('\n'));if(compact(words))cues.push(renderable?{start,end,words,block,row,lines}:{start,end,words});
    }
    if(renderable)render=replacements=>{for(const [cue,words]of replacements)blocks[cue.block]=cue.lines.slice(0,cue.row+1).concat(escapeText(words)).join('\n');return blocks.join('\n\n').replace(/\n/g,newline);};
  }else throw Error('caption format');
  if(cues.length>20000)throw Error('caption count');
  cues.sort((a,b)=>a.start-b.start);return{cues,render,format};
}
// Render into the document the native player already accepted. Translation may
// arrive in another supported representation; it never replaces the envelope.
export function mergeTimelines(target,source,{baseOriginal=false,dual=true,layout=false,language}={}){
  if(!target.cues.length||!source.cues.length)return null;
  const replacements=new Map();
  for(const cue of target.cues){
    let low=0,high=source.cues.length;
    while(low<high){const mid=(low+high)>>>1;if(source.cues[mid].start<cue.start-30000)low=mid+1;else high=mid;}
    const words=[];
    for(let i=low;i<source.cues.length&&i<low+200;i++){
      const candidate=source.cues[i];if(candidate.start>=cue.end+80)break;
      const overlap=Math.min(candidate.end,cue.end)-Math.max(candidate.start,cue.start),shorter=Math.max(1,Math.min(candidate.end-candidate.start,cue.end-cue.start));
      if(overlap/shorter>=0.25||Math.abs(candidate.start-cue.start)<=60)words.push(compact(candidate.words));
    }
    const first=[...new Set(words)].filter(Boolean).join(' '),second=compact(cue.words);
    if(first&&second&&first!==second&&!second.startsWith(first+' ')){
      const translated=baseOriginal?first:cue.words.trim(),original=baseOriginal?cue.words.trim():first;
      const formatted=layout?formatTranslation(translated,language):translated;
      replacements.set(cue,dual?original+'\n'+formatted:formatted);
    }
  }
  return replacements.size?target.render(replacements):null;
}
// A native translated track needs no companion request. Leave rolling JSON3
// append groups alone rather than changing their timing just to wrap text.
export function reflowTimeline(timeline,language){
  const replacements=new Map();
  for(const cue of timeline.cues){if(cue.events?.length>1)continue;const words=formatTranslation(cue.words,language);if(words!==cue.words)replacements.set(cue,words);}
  return replacements.size?timeline.render(replacements,{textOnly:true}):null;
}
export function bilingual(translated,original){return mergeTimelines(readTimeline(translated),readTimeline(original));}
