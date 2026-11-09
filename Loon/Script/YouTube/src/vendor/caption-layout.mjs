// Copyright 2026 Horatio Xu. MIT. Text-only wrapping; native player owns styling.
const LINE_WIDTH=36; // Soft visual units: a Han character counts as two.
const closing=',.!?:;%)]}，。！？；：、％）］｝」』】〕〉》”’';
const opening='([{（［｛「『【〔〈《“‘';
const strong='。！？；';
const weak='，、：';
function cjk(n){return n>=0x3400&&n<=0x9fff||n>=0xf900&&n<=0xfaff||n>=0x20000&&n<=0x323af||n>=0x3041&&n<=0x3096||n>=0x30a1&&n<=0x30fa||n>=0xac00&&n<=0xd7a3;}
function width(n){
  if(n===0x200d||n>=0x300&&n<=0x36f||n>=0x1ab0&&n<=0x1aff||n>=0x1dc0&&n<=0x1dff||n>=0x20d0&&n<=0x20ff||n>=0xfe00&&n<=0xfe0f||n>=0xe0100&&n<=0xe01ef)return 0;
  return cjk(n)||n>=0x1100&&n<=0x11ff||n>=0x2e80&&n<=0x303f||n>=0xff01&&n<=0xff60||n>=0x1f000&&n<=0x1faff?2:1;
}
export function formatTranslation(value,language){
  let text=String(value);
  // Common compact short cues cannot exceed the soft width, even in CJK.
  if(text.length<=LINE_WIDTH/2&&!/\s/.test(text))return text;
  text=text.replace(/\s+/g,' ').trim();
  if(/^zh(?:-|$)/i.test(language||''))text=text.replace(/ +([，。！？；：、」』】〕〉》）])/g,'$1').replace(/([「『【〔〈《（]) +/g,'$1').replace(/([，。！？；：、]) +(?=[\u3400-\u9fff])/g,'$1');
  let total=0;for(const point of text)total+=width(point.codePointAt(0));
  if(total<=LINE_WIDTH)return text;
  // Two forward scans, constant bookkeeping, no word/candidate arrays or cache.
  let left=0,previous='',previousPoint=0,best=-1,bestScore=Infinity;
  for(let index=0;index<text.length;){
    const point=text.codePointAt(index),size=point>0xffff?2:1,current=text.slice(index,index+size);
    const space=current===' ',punct=strong.includes(previous)||weak.includes(previous),latinPunct=space&&'.!?;,:'.includes(previous);
    if(index&&previous!==' '&&(space||punct||cjk(previousPoint)&&cjk(point))){
      const next=space?text.slice(index+1,index+3):current,right=total-left-(space?1:0);
      if(left>=4&&right>=4&&!closing.includes(next[0])&&!opening.includes(previous)){
        const penalty=strong.includes(previous)||latinPunct&&'.!?;'.includes(previous)?0:weak.includes(previous)||latinPunct?7:space?5:18;
        const score=Math.abs(left-right)+4*(Math.max(0,left-LINE_WIDTH)+Math.max(0,right-LINE_WIDTH))+penalty;
        if(score<bestScore){bestScore=score;best=index;}
      }
    }
    left+=width(point);previous=current;previousPoint=point;index+=size;
  }
  return best<0?text:text.slice(0,best).trimEnd()+'\n'+text.slice(best).trimStart();
}
