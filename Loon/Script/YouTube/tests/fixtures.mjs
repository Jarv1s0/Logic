import protobuf from 'protobufjs';
// Independent writer/reader: the production wire editor is not used to make or inspect fixtures.
export const combine=(...parts)=>Buffer.concat(parts.map(x=>Buffer.from(x)));
export function binary(no,payload){return Buffer.from(protobuf.Writer.create().uint32(no*8+2).bytes(payload).finish());}
export function integer(no,value){return Buffer.from(protobuf.Writer.create().uint32(no*8).uint64(String(value)).finish());}
export const string=(no,value)=>binary(no,Buffer.from(value,'utf8'));
export function inspect(raw){
  const reader=protobuf.Reader.create(raw),fields=[];
  while(reader.pos<reader.len){const start=reader.pos,tag=reader.uint32(),id=tag>>>3,wire=tag&7;let value;
    if(wire===2)value=reader.bytes();else if(wire===0)value=reader.uint64().toString();else reader.skipType(wire);
    fields.push({id,wire,value,raw:Buffer.from(raw.subarray(start,reader.pos))});
  }return fields;
}
export const at=(raw,n)=>inspect(raw).find(f=>f.id===n)?.value;
export const all=(raw,n)=>inspect(raw).filter(f=>f.id===n).map(f=>f.value);
export const captionUrl='https://www.youtube.com/api/timedtext?v=SELF-WRITTEN&lang=en&fmt=json3&signature=AB%2BC%2FD';
export const opaque=combine(string(499,'opaque bytes must not be interpreted'),integer(500,'18446744073709551615'));
export function player(){
  const track=combine(string(1,captionUrl),binary(2,binary(1,string(1,'English'))),string(3,'.en'),string(4,'en'),integer(7,1),string(99,'original-track-unknown'));
  const audio=combine(integer(2,0),integer(3,0),string(98,'audio-unknown'));
  const list=combine(binary(1,track),binary(2,audio),string(97,'caption-list-unknown'));
  return combine(binary(7,string(999,'short ad')),binary(45,string(999,'short ad')),binary(68,string(999,'short ad')),binary(10,binary(51621377,list)),binary(4,opaque),opaque);
}
export function guide(){
  function item(id){return binary(1,binary(117501096,combine(string(1,id),binary(2,binary(48687626,string(2,id))),opaque)));}
  const bar=combine(...['FEwhat_to_watch','FEshorts','FEuploads','FEsubscriptions','FElibrary'].map(item),string(88,'bar-unknown'));
  const wrapped=binary(117866661,bar);
  return combine(binary(4,wrapped),binary(6,wrapped),opaque);
}
export function ids(raw,no=4){const wrapper=at(raw,no),bar=at(wrapper,117866661);return all(bar,1).map(item=>Buffer.from(at(at(item,117501096),1)).toString());}
export const originalCaptions=JSON.stringify({wireMagic:'pb3',events:[{tStartMs:1000,dDurationMs:1500,segs:[{utf8:'An original "line"'}]},{tStartMs:3000,dDurationMs:1200,segs:[{utf8:'A second original line'}]}]});
export const translatedCaptions=JSON.stringify({wireMagic:'pb3',events:[{tStartMs:1000,dDurationMs:1500,segs:[{utf8:'一行中文'}]},{tStartMs:3000,dDurationMs:1200,segs:[{utf8:'第二行中文'}]}]});

// Native iOS homepage shapes observed on 2026-10-17, with self-written content.
export const homeVideoCard=label=>binary(153515154,combine(binary(172660663,string(999,label)),opaque));
export const homeAdCard=()=>binary(424701016,string(999,'self-written advertising layout'));
export const homeSection=cards=>binary(50195462,combine(...cards.map(card=>binary(1,card)),binary(4,opaque),integer(8,1),opaque));
const homeList=contents=>binary(49399797,combine(...contents.map(s=>binary(1,s)),binary(2,string(60487319,'self-written continuation token')),opaque));
export const homeFirstPage=contents=>combine(binary(9,binary(58173949,binary(1,binary(58174010,combine(string(2,'Home'),integer(3,1),binary(4,homeList(contents)),string(11,'FEwhat_to_watch'),opaque))))),opaque);
export const homeContinuationPage=contents=>combine(binary(10,homeList(contents)),opaque);
export const homeListFrom=(body,kind)=>kind==='first'?at(at(at(at(at(at(body,9),58173949),1),58174010),4),49399797):at(at(body,10),49399797);
export const homeContents=(body,kind)=>all(homeListFrom(body,kind),1);
