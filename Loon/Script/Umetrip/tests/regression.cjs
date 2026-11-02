const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../umetrip_ads.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../../../umetrip.plugin'), 'utf8');
const rule = new RegExp(plugin.match(/^http-response (\S+)/m)[1]);
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
assert.ok(plugin.includes('binary-body-mode=true'));

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
function oracle(bytes, rpid, route = [7, 1, rpid === '1000002' ? 2 : 1]) {
  return Buffer.concat(read(bytes).flatMap(f => {
    if (route.length) return f.n === route[0] && f.w === 2 ? [field(f.n, oracle(f.value, rpid, route.slice(1)))] : [f.raw];
    if (f.n !== 5 || f.w !== 2) return [f.raw];
    const g = read(f.value), id = g.find(x => x.n === 3 && x.w === 0)?.value;
    if (rpid === '1000002') {
      const advert = g.some(x => x.n === 37 && x.w === 2 && x.value.toString() === 'ADVERT');
      return advert || [111288, 111281, 111326, 1296].includes(id) ? [] : [f.raw];
    }
    if (id !== 111286) return [f.raw];
    return [field(5, Buffer.concat(g.filter(c => c.n !== 8 || c.w !== 2 ||
      ![306222, 306379, 306214, 306225, 306219, 306244, 306220, 306245].includes(read(c.value).find(x => x.n === 2 && x.w === 0)?.value)).map(c => c.raw)))];
  }));
}
if (process.argv[2]) {
  const entries = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).log.entries;
  let homes = 0, waterfalls = 0, launches = 0, untouched = 0;
  const old = cp.execFileSync('git', ['show', 'e4dae21:Loon/Script/Umetrip/umetrip_ads.js'], { encoding: 'utf8' });
  for (const e of entries) {
    const u = new URL(e.request.url);
    if (!/(^|\.)umetrip\.com$/.test(u.hostname)) continue;
    const rpid = e.request.headers.find(h => h.name.toLowerCase() === 'rpid')?.value;
    const c = e.response.content, bytes = c.encoding === 'base64' ? Buffer.from(c.text || '', 'base64') : Buffer.from(c.text || '');
    const result = run(bytes, rpid, e.request.url);
    if (rpid === '1000002' && u.hostname === 'umehome.umetrip.com') {
      assert.ok(!new RegExp('^https?:\\/\\/(114\\.115\\.217\\.129|home\\.umetrip\\.com)\\/').test(e.request.url));
      assert.notDeepEqual(Buffer.from(run(bytes, rpid, e.request.url, old).body || bytes), oracle(bytes, rpid));
      assert.deepEqual(Buffer.from(result.body), oracle(bytes, rpid));
      homes++;
    } else if (rpid === '1000029' && u.hostname === 'opactivity.umetrip.com') {
      assert.deepEqual(Buffer.from(result.body), oracle(bytes, rpid)); waterfalls++;
    } else if (rpid === '1000019' && u.hostname === 'sns.umetrip.com') {
      assert.equal(result.status, 'HTTP/1.1 404 Not Found'); launches++;
    } else { assert.equal(Object.keys(result).length, 0); untouched++; }
    if (result.body) assert.equal(Object.keys(run(result.body, rpid, e.request.url)).length, 0);
  }
  assert.ok(homes && waterfalls && launches);
  console.log(`HAR: home=${homes}, waterfall=${waterfalls}, splash=${launches}, passthrough=${untouched}; old failure confirmed`);
}
console.log(`${checks} script executions passed`);
