import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeMessage,encodeVarint,join,planMessage,materializeMessage,withPayload} from '../src/vendor/wire.mjs';
import {combine,binary,integer,string,inspect} from './fixtures.mjs';

test('uint32 tag fast path agrees with the independent protobuf reader at all tag boundaries',()=>{
  const ids=[1,15,16,2047,2048,262143,262144,33554431,33554432,474376530,536870911];
  const raw=combine(...ids.flatMap(id=>[binary(id,Buffer.from([0,255,128])),integer(id,'18446744073709551615')]));
  const wrapped=combine(Buffer.alloc(19,99),raw,Buffer.alloc(17,99)),view=wrapped.subarray(19,19+raw.length);
  const actual=decodeMessage(view),reference=inspect(view);assert.equal(actual.length,reference.length);
  actual.forEach((f,i)=>{assert.equal(f.no,reference[i].id);assert.equal(f.wire,reference[i].wire);assert.deepEqual(Buffer.from(f.raw),reference[i].raw);assert.equal(f.data,view);if(f.wire===0)assert.equal(f.value.toString(),reference[i].value);else assert.deepEqual(Buffer.from(f.payload),Buffer.from(reference[i].value));});
});
test('scalar and packed 64-bit precision stays intact above Number safe range',()=>{
  const values=[0n,127n,128n,16383n,16384n,4294967295n,4294967296n,9007199254740991n,9007199254740992n,9223372036854775808n,18446744073709551615n];
  for(const n of values){assert.deepEqual(Buffer.from(encodeVarint(n)),integer(1,n).subarray(1));if(n<=9007199254740991n)assert.deepEqual(encodeVarint(Number(n)),encodeVarint(n));assert.equal(decodeMessage(integer(1,n))[0].value,n);}
});
const overlong=(bytes,count)=>combine(bytes.subarray(0,-1),Buffer.from([bytes.at(-1)|128]),Buffer.alloc(count-1,128),Buffer.from([0]));
test('valid non-canonical uint32 encodings through ten bytes retain exact tags and raw data',()=>{
  for(let count=1;count<=9;count++){
    const tag=overlong(Buffer.from([10]),count),length=overlong(Buffer.from([3]),count),raw=combine(tag,length,Buffer.from('abc'));
    const f=decodeMessage(raw)[0];assert.equal(f.no,1);assert.deepEqual(Buffer.from(f.tag),tag);assert.deepEqual(Buffer.from(f.payload),Buffer.from('abc'));assert.deepEqual(Buffer.from(f.raw),raw);
  }
});
test('invalid, overflowing and truncated wire encodings are still rejected',()=>{
  const bad=[[],[0],[14],[11],[128],[10,128],[10,4,1],[9,1],[13,1],[8,128],...[[255,255,255,255,31],[128,128,128,128,16],[128,128,128,128,128,1]],Array(11).fill(128),[8,...Array(9).fill(255),2],[10,255,255,255,255,15]];
  for(const bytes of bad.slice(1))assert.throws(()=>decodeMessage(Uint8Array.from(bytes)),undefined,bytes.join(','));
  assert.deepEqual(decodeMessage(new Uint8Array()),[]);
});
test('fixed wire types, payload-size boundaries and field-count guards remain exact',()=>{
  const raw=combine(Buffer.from([9]),Buffer.alloc(8,7),Buffer.from([21]),Buffer.alloc(4,255),binary(7,Buffer.alloc(16384,65)));
  const fs=decodeMessage(raw);assert.deepEqual(fs.map(f=>[f.no,f.wire]),[[1,1],[2,5],[7,2]]);assert.deepEqual(Buffer.from(join(fs.map(f=>f.raw))),raw);assert.throws(()=>decodeMessage(raw,2),/field count/);
});
test('planned writes preserve untouched non-canonical fields and replace only specified ranges',()=>{
  const untouched=combine(overlong(Buffer.from([58]),4),overlong(Buffer.from([3]),2),Buffer.from('xyz'));
  const raw=combine(untouched,string(1,'before'),integer(99,'18446744073709551615'),string(2,'remove'),untouched),fs=decodeMessage(raw);
  const fresh=Buffer.from('after'),plan=planMessage(raw,[{field:fs[1],payload:fresh},{field:fs[3],payload:null}]);
  assert.deepEqual(Buffer.from(materializeMessage(plan)),combine(untouched,binary(1,fresh),integer(99,'18446744073709551615'),untouched));
  assert.equal(materializeMessage(planMessage(raw,null)),raw);
});
test('nested planned writes correctly cross encoded-length boundaries and handle complete deletion',()=>{
  for(const size of [1,125,126,127,128,16380,16383,16384]){
    const leaf=combine(string(1,'drop'),binary(2,Buffer.alloc(size,65))),inner=binary(3,leaf),raw=binary(4,inner);
    const f=decodeMessage(leaf)[0],child=planMessage(leaf,[{field:f,payload:null}]),middle=planMessage(inner,[{field:decodeMessage(inner)[0],payload:child}]),plan=planMessage(raw,[{field:decodeMessage(raw)[0],payload:middle}]);
    assert.deepEqual(Buffer.from(materializeMessage(plan)),binary(4,binary(3,binary(2,Buffer.alloc(size,65)))));
  }
  const raw=string(1,'only');assert.equal(materializeMessage(planMessage(raw,[{field:decodeMessage(raw)[0],payload:null}])).length,0);
});
test('payload replacement keeps the exact original tag bytes',()=>{
  const raw=combine(overlong(Buffer.from([10]),5),Buffer.from([1,65])),f=decodeMessage(raw)[0];
  assert.deepEqual(Buffer.from(withPayload(f,Buffer.from('BC'))),combine(raw.subarray(0,6),Buffer.from([2,66,67])));
});
