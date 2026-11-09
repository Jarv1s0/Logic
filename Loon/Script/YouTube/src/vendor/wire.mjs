// Copyright 2026 Horatio Xu. MIT. Independent, loss-preserving protobuf editing.
// Fields that are not edited retain their exact original tag, payload and length bytes.
export function join(parts) {
  const out = new Uint8Array(parts.reduce((n,p) => n + p.length, 0));
  let at = 0; for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}
export function encodeVarint(value) {
  if (Number.isSafeInteger(value) && value >= 0) {
    let n=value, size=1; while(n>=128){n=Math.floor(n/128);size++;}
    const out=new Uint8Array(size);n=value;
    for(let i=0;i<size;i++){out[i]=(n%128)|(i+1<size?128:0);n=Math.floor(n/128);}return out;
  }
  let n = BigInt(value); if (n < 0n || n > 0xffffffffffffffffn) throw Error('varint range');
  const result = [];
  do { const low = Number(n & 127n); n >>= 7n; result.push(low | (n ? 128 : 0)); } while (n);
  return new Uint8Array(result);
}
// Tags and lengths are bounded uint32 values. Avoid a BigInt and a return
// object for every byte; still consume/validate legal overlong encodings.
function uint32(data, cursor) {
  let value=0;
  for(let i=0;i<10;i++){
    if(cursor.pos>=data.length)throw Error('truncated varint');
    const b=data[cursor.pos++];if(i===9&&b>1)throw Error('overflow varint');
    const low=b&127;
    if(i<4)value+=low*2**(7*i);
    else if(i===4&&low<=15)value+=low*268435456;
    else if(low)value=Infinity;
    if(!(b&128))return value;
  }throw Error('overflow varint');
}
// Most fields are inspected but never rewritten. Keep offsets rather than
// eagerly allocating raw/tag views for every field and every inspection.
class Field {
  constructor(data,start,tagEnd,end,no,wire,payload,value){this.data=data;this.start=start;this.tagEnd=tagEnd;this.end=end;this.no=no;this.wire=wire;this.payload=payload;this.value=value;}
  get tag(){return this.data.subarray(this.start,this.tagEnd);}
  get raw(){return this.data.subarray(this.start,this.end);}
}
function varint(data, pos) {
  let value = 0n;
  for (let shift = 0n; shift < 70n; shift += 7n) {
    if (pos >= data.length) throw Error('truncated varint');
    const b = data[pos++];
    if (shift === 63n && b > 1) throw Error('overflow varint');
    value |= BigInt(b & 127) << shift;
    if (!(b & 128)) return { value, pos };
  }
  throw Error('overflow varint');
}
export function decodeMessage(data, maxFields = 100000) {
  const list = [], cursor={pos:0}; let pos = 0;
  while (pos < data.length) {
    if (list.length >= maxFields) throw Error('field count');
    const begin=pos;cursor.pos=pos;const key=uint32(data,cursor);pos=cursor.pos;
    if (key > 0xffffffff) throw Error('invalid field number');
    const no=Math.floor(key/8),wire=key%8,tagEnd=pos;
    if (!no || no > 536870911) throw Error('invalid field number');
    let payload, value;
    if (wire === 0) { const scalar = varint(data, pos); value = scalar.value; pos = scalar.pos; }
    else if (wire === 1 || wire === 5) pos += wire === 1 ? 8 : 4;
    else if (wire === 2) {
      cursor.pos=pos;const size=uint32(data,cursor);pos=cursor.pos;
      if (size > data.length - pos) throw Error('truncated message');
      payload = data.subarray(pos, pos + size); pos += size;
    } else throw Error('unsupported group wire');
    if (pos > data.length) throw Error('truncated fixed field');
    list.push(new Field(data,begin,tagEnd,pos,no,wire,payload,value));
  }
  return list;
}
export const nested = field => field?.wire === 2 ? decodeMessage(field.payload) : [];
export const findField = (list, no) => list.find(f => f.no === no);
export function withPayload(field, payload) {
  const tag=field.tag,length=encodeVarint(payload.length),out=new Uint8Array(tag.length+length.length+payload.length);
  out.set(tag);out.set(length,tag.length);out.set(payload,tag.length+length.length);return out;
}
class MessagePlan {
  constructor(raw,edits){
    this.raw=raw;this.edits=edits;this.length=raw.length;
    for(const edit of edits){
      const {field,payload}=edit;edit.size=payload?.length?encodeVarint(payload.length):null;
      this.length+=(edit.size?field.tagEnd-field.start+edit.size.length+payload.length:0)-(field.end-field.start);
    }
  }
}
// Only modified fields need a plan. Unchanged spans keep their exact wire
// encodings, including unknown fields and non-canonical varints. No output
// buffer exists until the complete tree has passed its processing budgets.
export const planMessage=(raw,edits)=>edits?.length?new MessagePlan(raw,edits):raw;
export const changedMessage=(value,raw)=>value instanceof MessagePlan||!same(value,raw);
export function materializeMessage(value){
  if(!(value instanceof MessagePlan))return value;
  const out=new Uint8Array(value.length);
  function write(part,at){
    if(!(part instanceof MessagePlan)){out.set(part,at);return at+part.length;}
    let cursor=0;
    for(const {field,payload,size} of part.edits){
      out.set(part.raw.subarray(cursor,field.start),at);at+=field.start-cursor;
      if(size){const tag=field.tag;out.set(tag,at);at+=tag.length;out.set(size,at);at+=size.length;at=write(payload,at);}
      cursor=field.end;
    }
    out.set(part.raw.subarray(cursor),at);return at+part.raw.length-cursor;
  }
  write(value,0);return out;
}
export function makeBytes(no, payload) { return join([encodeVarint(BigInt(no) * 8n + 2n), encodeVarint(payload.length), payload]); }
export function makeInt(no, value) { return join([encodeVarint(BigInt(no) * 8n), encodeVarint(value)]); }
export function replaceAll(list, no, replacements) {
  let written = false; const out = [];
  for (const field of list) {
    if (field.no !== no) out.push(field.raw);
    else if (!written) { out.push(...replacements); written = true; }
  }
  if (!written) out.push(...replacements);
  return join(out);
}
export function readPacked(field) {
  if (field.wire === 0) return [field.value];
  if (field.wire !== 2) throw Error('wrong packed type');
  const values = []; let pos = 0;
  while (pos < field.payload.length) { const v = varint(field.payload, pos); values.push(v.value); pos = v.pos; }
  return values;
}
export function same(a,b) { if (a === b) return true; if (a.length !== b.length) return false; for (let i=0;i<a.length;i++) if(a[i]!==b[i]) return false; return true; }
