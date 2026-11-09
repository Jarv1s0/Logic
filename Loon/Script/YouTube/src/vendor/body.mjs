// Copyright 2026 Horatio Xu. MIT. Bounded decoding when a client delivers raw gzip.
import {Gunzip} from 'fflate';
import {join} from './wire.mjs';
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function unpackHttp(raw,limit){
  // Some clients already decode the body while retaining Content-Encoding.
  // Use the actual gzip magic, not that potentially stale header.
  if(raw[0]!==31||raw[1]!==139)return{bytes:raw,gzip:false};
  if(raw.length<18)throw Error('gzip invalid');
  const footer=new DataView(raw.buffer,raw.byteOffset+raw.length-8,8),advertised=footer.getUint32(4,true);
  if(advertised>limit)throw Error('body too large');
  const parts=[];let size=0,finished=false,crc=0xffffffff;
  const unzip=new Gunzip((chunk,final)=>{
    size+=chunk.length;if(size>limit)throw Error('body too large');
    for(const byte of chunk)crc=crcTable[(crc^byte)&255]^(crc>>>8);
    parts.push(chunk);if(final)finished=true;
  });
  // Multiple gzip members are outside this HTTP decoder's supported framing.
  unzip.onmember=()=>{throw Error('gzip multiple members');};
  for(let at=0;at<raw.length;at+=1024)unzip.push(raw.subarray(at,at+1024),at+1024>=raw.length);
  if(!finished||size!==advertised||((crc^0xffffffff)>>>0)!==footer.getUint32(0,true))throw Error('gzip invalid');
  return{bytes:join(parts),gzip:true};
}
