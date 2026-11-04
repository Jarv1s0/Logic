const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../umetrip_ads.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../../../umetrip.plugin'), 'utf8');
const [, pattern, flags] = plugin.match(/^response if \$\{url\} ~= \/(.+)\/([ims]*) then script\(/m);
const rule = new RegExp(pattern, flags);
const url = 'https://umehome.umetrip.com/gateway/api/umetrip/native';
let checks = 0;
function run(body, rpid = '1000002', requestUrl = url, code = source) {
  const results = [];
  vm.runInNewContext(code, {
    Uint8Array, ArrayBuffer,
    $request: { url: requestUrl, headers: { RPID: rpid } },
    $response: { body }, $done: result => results.push(result),
  });
  assert.equal(results.length, 1);
  checks++;
  return results[0];
}
const varint = value => {
  const out = [];
  do { const n = value % 128; value = Math.floor(value / 128); out.push(n | (value ? 128 : 0)); } while (value);
  return Buffer.from(out);
};
const field = (n, value) => Buffer.concat([varint(n * 8 + 2), varint(value.length), value]);
const integer = (n, value) => Buffer.concat([varint(n * 8), varint(value)]);
const text = (n, value) => field(n, Buffer.from(value));
const join = (...parts) => Buffer.concat(parts);
const group = (id, advert = false) => join(integer(3, id), ...(advert ? [text(37, 'ADVERT')] : []), text(50, 'unknown'));
const card = id => join(integer(2, id), text(60, 'unknown card'));
const wrap = (page, rpid = '1000002') => join(text(5, rpid), field(7, field(1, field(rpid === '1000002' ? 2 : 1, page))), text(90, 'unknown root'));
const kept = field(5, group(111287));
const dirty = wrap(join(field(5, group(1009, true)), field(5, group(111288)), kept));
assert.deepEqual(Buffer.from(run(dirty).body), wrap(kept));
assert.equal(Object.keys(run(wrap(kept))).length, 0);
const waterUrl = url.replace('umehome.', 'opactivity.');
const water = cards => wrap(field(5, join(integer(3, 111286), ...cards.map(c => field(8, card(c))))), '1000029');
assert.deepEqual(Buffer.from(run(water([306222, 306204, 999999]), '1000029', waterUrl).body), water([306204, 999999]));
for (const body of [Buffer.from([0xff]), Buffer.from([0x3a, 0xff, 0x7f]), Buffer.from([0x0d, 1]), 'text', undefined]) {
  assert.equal(Object.keys(run(body)).length, 0);
}
assert.equal(Object.keys(run(dirty, null)).length, 0);
assert.equal(Object.keys(run(dirty, '10000020')).length, 0);
assert.equal(Object.keys(run(dirty, '1000002', waterUrl)).length, 0);
assert.equal(Object.keys(run(wrap(kept, 'other'))).length, 0);
assert.equal(run(Buffer.alloc(0), '1000019', url.replace('umehome.', 'sns.')).status, 'HTTP/1.1 404 Not Found');
assert.ok(rule.test(url));
assert.ok(rule.test(waterUrl));
assert.ok(!rule.test('https://example.com/gateway/api/umetrip/native'));
assert.ok(plugin.includes('binary_body_mode=true'));

const mineUrl = url.replace('umehome.', 'umerp.');
const mineWrap = page => join(text(5, '1100001'), field(7, field(1, field(11, page))), text(90, 'unknown'));
assert.deepEqual(Buffer.from(run(mineWrap(join(field(5, group(1297)), field(5, group(111310)), kept)), '1100001', mineUrl).body), mineWrap(kept));
const service = {children:[{cardId:'a',title:'航旅会',department:'equity'}, {cardId:'b',title:'常客卡'}, {cardId:'c',title:'里程兑会员'}, {cardId:'d',title:'客服'}], childrenIndex:{a:0,b:1,c:2,d:3}, unknown:'keep'};
const serviceWrap = data => wrap(field(5, join(integer(3,111280), field(8, text(7, JSON.stringify(data))))));
const expectedService = {children:[service.children[1],service.children[3]], childrenIndex:{b:0,d:1}, unknown:'keep'};
assert.deepEqual(Buffer.from(run(serviceWrap(service)).body), serviceWrap(expectedService));
assert.equal(Object.keys(run(serviceWrap(expectedService))).length,0);
const malformedJson = wrap(field(5, join(integer(3,111280),field(8,text(7,'{invalid')))));
assert.equal(Object.keys(run(malformedJson)).length,0);
const memberWrap = value => join(text(5,'1370286'),field(7,field(1,value)),text(90,'unknown'));
assert.deepEqual(Buffer.from(run(memberWrap(join(text(2,'member payload'),text(88,'keep'))),'1370286',mineUrl).body),memberWrap(text(88,'keep')));
assert.equal(Object.keys(run(memberWrap(text(2,'member payload')),'1370286',url)).length,0);
assert.ok(rule.test(mineUrl));
const rejects = [...plugin.matchAll(/^request if \$\{url\} ~= \/(.+)\/([ims]*) then reject\(404\)$/gm)].map(match=>new RegExp(match[1], match[2]));
assert.equal(rejects.length, 3, '必须读取全部资源拦截规则');
for(const asset of ['equityCenter/static/test','membership/rights/test'])assert.ok(rejects.some(re=>re.test('https://oss.umetrip.com/fs/'+asset)));
assert.ok(!rejects.some(re=>re.test('https://oss.umetrip.com/fs/airline/logo/test')));
assert.ok(!rejects.some(re=>re.test('https://oss.umetrip.com/fs/user/profilePicture/test')));
const bannerPage = mineWrap(join(field(5,group(111249)),kept));
assert.deepEqual(Buffer.from(run(bannerPage,'1100001',mineUrl).body),mineWrap(kept));
for(const ad of [{trackParam:{department:'advert'}},{serviceTrack:'advert_123_no'}]){
  const mixed = wrap(field(5,join(integer(3,999999),field(8,text(7,JSON.stringify(ad))),field(8,text(7,'{"title":"客服"}')))));
  const expected = wrap(field(5,join(integer(3,999999),field(8,text(7,'{"title":"客服"}')))));
  assert.deepEqual(Buffer.from(run(mixed).body),expected);
}
const onlyAd=wrap(field(5,join(integer(3,999999),field(8,text(7,'{"trackParam":{"department":"advert"}}')))));
assert.deepEqual(Buffer.from(run(onlyAd).body),wrap(Buffer.alloc(0)));
const lowerPage=mineWrap(join(field(5,group(111311)),field(5,group(111312)),field(5,group(111309)),field(5,group(999999))));
assert.deepEqual(Buffer.from(run(lowerPage,'1100001',mineUrl).body),mineWrap(join(field(5,group(111309)),field(5,group(999999)))));
const tripUrl=url.replace('umehome.','activity.');
assert.ok(rule.test(tripUrl));
assert.ok(plugin.match(/^hostname = .+$/m)[0].split(/,\s*/).includes('activity.umetrip.com'));
const trip=cards=>{
  const group=join(integer(3,1271),...cards.map(j=>field(8,text(7,JSON.stringify(j)))));
  const page=field(5,group);
  return join(text(5,'1370126'),field(7,field(1,field(1,page))),text(90,'keep'));
};
const tripMember={trackParam:{department:'equity'},lottieAndVideo:'{"text":"会员送全年航延险","isShow":1}'};
const tripNormal={trackParam:{department:'train'},lottieAndVideo:'{"text":"打开轨迹图","isShow":1}'};
assert.deepEqual(Buffer.from(run(trip([tripMember,tripNormal]),'1370126',tripUrl).body),trip([tripNormal]));
assert.equal(Object.keys(run(trip([tripMember,tripNormal]),'1370126',url)).length,0);

// 独立读取 Protobuf 字段，用真实 HAR 验证完整字节差异；不存储任何抓包数据。
function read(bytes) {
  let offset = 0;
  function number() {
    let value = 0n, shift = 0n;
    for (;;) {
      const b = bytes[offset++];
      assert.notEqual(b, undefined);
      value |= BigInt(b & 127) << shift;
      if (b < 128) return value;
      shift += 7n;
      assert.ok(shift <= 70n);
    }
  }
  const out = [];
  while (offset < bytes.length) {
    const start = offset, tag = Number(number()), n = tag >>> 3, w = tag & 7;
    let value;
    if (w === 0) value = Number(number());
    else if (w === 2) { const length = Number(number()); value = bytes.subarray(offset, offset + length); offset += length; }
    else if (w === 1 || w === 5) offset += w === 1 ? 8 : 4;
    else throw new Error('invalid wire type');
    assert.ok(offset <= bytes.length);
    out.push({ n, w, value, raw: bytes.subarray(start, offset) });
  }
  return out;
}
function memberJson(raw) {
  let value;try {value=JSON.parse(raw.toString());}catch{return raw;}
  const isMember = item => item && typeof item === 'object' && (item.department === 'equity' || ['equity','advert'].includes(item.trackParam?.department) || /^advert_/.test(item.serviceTrack||'') ||
    ['title','serviceName','businessTitle'].some(k=>typeof item[k]==='string'&&/会员|航旅会/.test(item[k])) ||
    ['parameter','weexParams'].some(k=>item[k]&&/payMember|memberCardbag|memberequity\.umetrip\.com/i.test(JSON.stringify(item[k]))));
  if(isMember(value))return null;
  let changed=false;
  function visit(v){
    if(!v||!Array.isArray(v.children))return;
    const original=v.children;
    const retained=original.map((child,i)=>({child,i})).filter(x=>!isMember(x.child));
    if(retained.length!==original.length){
      changed=true;
      if(v.childrenIndex&&typeof v.childrenIndex==='object'&&!Array.isArray(v.childrenIndex))for(const key of Object.keys(v.childrenIndex)){
        const old=v.childrenIndex[key];if(!Number.isInteger(old)||old<0||old>=original.length)continue;
        const next=retained.findIndex(x=>x.i===old);if(next<0)delete v.childrenIndex[key];else v.childrenIndex[key]=next;
      }
      v.children=retained.map(x=>x.child);
    }
    retained.forEach(x=>visit(x.child));
  }
  visit(value);return changed?Buffer.from(JSON.stringify(value)):raw;
}
function oracle(bytes, rpid, route = [7, 1, rpid === '1100001' ? 11 : rpid === '1000002' ? 2 : 1]) {
  return Buffer.concat(read(bytes).flatMap(f => {
    if(route.length===1&&rpid==='1000002'&&f.n===27&&f.w===2)return [];
    if(route.length===1&&rpid==='1370286'&&f.n===2&&f.w===2)return [];
    if (route.length) return f.n === route[0] && f.w === 2 ? [field(f.n, oracle(f.value, rpid, route.slice(1)))] : [f.raw];
    if (f.n !== 5 || f.w !== 2) return [f.raw];
    const g = read(f.value), id = g.find(x => x.n === 3 && x.w === 0)?.value;
    if (['1000002','1100001','1370126'].includes(rpid)) {
      const advert = g.some(x => x.n === 37 && x.w === 2 && x.value.toString() === 'ADVERT');
      if(advert || [111288, 111281, 111326, 1296].includes(id) || (rpid==='1100001'&&[1297,111310,111249,111311,111312].includes(id)))return [];
      let removedCard=false,retainedCards=0;
      const output=Buffer.concat(g.flatMap(c=>{
        if(c.n!==8||c.w!==2)return [c.raw];
        let drop=false;
        const parts=read(c.value).map(j=>{
          if(j.n!==7||j.w!==2)return j.raw;
          const next=memberJson(j.value);if(next===null){drop=true;return j.raw;}return field(7,next);
        });
        if(drop){removedCard=true;return [];}
        retainedCards++;return [field(8,Buffer.concat(parts))];
      }));
      return removedCard&&!retainedCards?[]:[field(5,output)];
    }
    if (id !== 111286) return [f.raw];
    return [field(5, Buffer.concat(g.filter(c => c.n !== 8 || c.w !== 2 ||
      ![306222, 306379, 306214, 306225, 306219, 306244, 306220, 306245].includes(read(c.value).find(x => x.n === 2 && x.w === 0)?.value)).map(c => c.raw)))];
  }));
}
if (process.argv[2]) {
  const entries = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).log.entries;
  let homes = 0, waterfalls = 0, launches = 0, untouched = 0, members = 0, tripBanners = 0;
  const old = cp.execFileSync('git', ['show', 'e4dae21:Loon/Script/Umetrip/umetrip_ads.js'], { encoding: 'utf8' });
  for (const e of entries) {
    const u = new URL(e.request.url);
    if (!/(^|\.)umetrip\.com$/.test(u.hostname)) continue;
    const rpid = e.request.headers.find(h => h.name.toLowerCase() === 'rpid')?.value;
    const c = e.response.content, bytes = c.encoding === 'base64' ? Buffer.from(c.text || '', 'base64') : Buffer.from(c.text || '');
    const result = run(bytes, rpid ?? null, e.request.url);
    if (rpid === '1000002' && u.hostname === 'umehome.umetrip.com') {
      assert.ok(!new RegExp('^https?:\\/\\/(114\\.115\\.217\\.129|home\\.umetrip\\.com)\\/').test(e.request.url));
      if(!bytes.equals(oracle(bytes,rpid)))assert.notDeepEqual(Buffer.from(run(bytes, rpid, e.request.url, old).body || bytes), oracle(bytes, rpid));
      assert.deepEqual(Buffer.from(result.body||bytes), oracle(bytes, rpid));
      homes++;
    } else if (rpid === '1000029' && u.hostname === 'opactivity.umetrip.com') {
      assert.deepEqual(Buffer.from(result.body||bytes), oracle(bytes, rpid)); waterfalls++;
    } else if (rpid === '1000019' && u.hostname === 'sns.umetrip.com') {
      assert.equal(result.status, 'HTTP/1.1 404 Not Found'); launches++;
    } else if(['1100001','1370286'].includes(rpid)&&u.hostname==='umerp.umetrip.com'){
      const expected=oracle(bytes,rpid,rpid==='1370286'?[7,1,2]:[7,1,11]);
      const actual=Buffer.from(result.body||bytes);
      assert.deepEqual(actual,expected);
      const previous=cp.execFileSync('git',['show','31e86e4:Loon/Script/Umetrip/umetrip_ads.js'],{encoding:'utf8'});
      if(!bytes.equals(expected))assert.notDeepEqual(Buffer.from(run(bytes,rpid,e.request.url,previous).body||bytes),expected);
      if(rpid==='1100001'){
        const prior=cp.execFileSync('git',['show','93af833:Loon/Script/Umetrip/umetrip_ads.js'],{encoding:'utf8'});
        const priorBody=Buffer.from(run(bytes,rpid,e.request.url,prior).body||bytes);
        if(bytes.includes(Buffer.from('advert_1016582_no')))assert.ok(priorBody.includes(Buffer.from('advert_1016582_no')));
        assert.ok(!actual.includes(Buffer.from('advert_1016582_no')));
        const last=cp.execFileSync('git',['show','85456cc:Loon/Script/Umetrip/umetrip_ads.js'],{encoding:'utf8'});
        const lastBody=Buffer.from(run(bytes,rpid,e.request.url,last).body||bytes);
        for(const title of ['票券权益','特价专区','买三送一','超值券包']){
          if(bytes.includes(Buffer.from(title)))assert.ok(lastBody.includes(Buffer.from(title)));
          assert.ok(!actual.includes(Buffer.from(title)));
        }
        const content=read(read(read(actual).find(f=>f.n===7).value).find(f=>f.n===1).value).find(f=>f.n===11).value;
        const templates=read(content).filter(f=>f.n===5&&f.w===2).map(g=>read(g.value).find(f=>f.n===3&&f.w===0)?.value);
        assert.deepEqual(templates,[111318,111309]);
      }
      members++;
    } else if(rpid==='1370126'&&u.hostname==='activity.umetrip.com'){
      assert.deepEqual(Buffer.from(result.body||bytes),oracle(bytes,rpid));
      if(bytes.includes(Buffer.from('会员送全年航延险')))assert.ok(result.body);
      else assert.equal(Object.keys(result).length,0);
      assert.ok(!Buffer.from(result.body||bytes).includes(Buffer.from('会员送全年航延险')));
      const payload=read(read(Buffer.from(result.body||bytes)).find(f=>f.n===7).value).find(f=>f.n===1).value;
      const page=read(payload).find(f=>f.n===1).value;
      const cards=read(page).filter(f=>f.n===5&&f.w===2).flatMap(g=>read(g.value).filter(c=>c.n===8&&c.w===2));
      assert.deepEqual(cards.map(c=>read(c.value).find(f=>f.n===2&&f.w===0)?.value),[306680,305519]);
      const previous=cp.execFileSync('git',['show','4ad7528:Loon/Script/Umetrip/umetrip_ads.js'],{encoding:'utf8'});
      assert.equal(Object.keys(run(bytes,rpid,e.request.url,previous)).length,0);
      tripBanners++;
    } else { assert.equal(Object.keys(result).length, 0); untouched++; }
    if (result.body) assert.equal(Object.keys(run(result.body, rpid, e.request.url)).length, 0);
    if(result.body&&['1000002','1100001','1370286'].includes(rpid))assert.ok(!/会员|航旅会|memberequity|payMember/i.test(Buffer.from(result.body).toString()));
  }
  assert.ok(homes && waterfalls && launches && members);
  console.log(`HAR: home=${homes}, waterfall=${waterfalls}, splash=${launches}, members=${members}, tripBanner=${tripBanners}, passthrough=${untouched}; old failure confirmed`);
}
console.log(`${checks} script executions passed`);
