/**
 * 航旅纵横；基于 fmz200/wool_scripts 的 umetrip_ads.js，GPL-3.0，见 LICENSE。
 * 上游：4b7830670baf235ed945085cb926dc499cf619e0。
 * 本地修改（2026-11-02，20261102-2）：适配新域名与 Protobuf，
 * 过滤 HAR 确认的推广组，保留首页服务和未知字段；异常响应透传。
 */

// 只解读已确认路径，其他字段保留原始字节及顺序。
function fields(bytes) {
  let offset = 0;
  function varint() {
    let value = 0;
    for (let i = 0; i < 10; i++) {
      if (offset >= bytes.length) throw new Error('truncated varint');
      const byte = bytes[offset++];
      if (i === 9 && byte > 1) throw new Error('invalid varint');
      value += (byte & 127) * Math.pow(2, i * 7);
      if (byte < 128) return Number.isSafeInteger(value) ? value : undefined;
    }
    throw new Error('invalid varint');
  }
  const result = [];
  while (offset < bytes.length) {
    const start = offset;
    const tag = varint();
    if (!Number.isSafeInteger(tag) || tag < 8 || tag > 0xffffffff) throw new Error('invalid tag');
    const number = Math.floor(tag / 8);
    const wire = tag % 8;
    let value;
    if (wire === 0) value = varint();
    else if (wire === 2) {
      const size = varint();
      if (!Number.isSafeInteger(size) || size > bytes.length - offset) throw new Error('invalid length');
      value = bytes.subarray(offset, offset + size);
      offset += size;
    } else if (wire === 1 || wire === 5) {
      offset += wire === 1 ? 8 : 4;
      if (offset > bytes.length) throw new Error('truncated fixed field');
    } else throw new Error('unsupported wire type');
    result.push({ number, wire, value, raw: bytes.subarray(start, offset) });
  }
  return result;
}

function encodeVarint(value) {
  const bytes = [];
  do {
    const part = value % 128;
    value = Math.floor(value / 128);
    bytes.push(part + (value ? 128 : 0));
  } while (value);
  return new Uint8Array(bytes);
}

function concat(parts) {
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}

function matchesAscii(bytes, text) {
  return bytes.length === text.length && bytes.every((byte, i) => byte === text.charCodeAt(i));
}

function valueOf(items, number) {
  const field = items.find(field => field.number === number && field.wire === 0);
  return field && field.value;
}

// 原对象表示不变，null 表示删除；仅为修改的父字段重写长度。
function rewrite(bytes, visitor) {
  let changed = false;
  const parts = fields(bytes).map(field => {
    const next = visitor(field);
    if (next === field.value) return field.raw;
    changed = true;
    if (next === null) return new Uint8Array(0);
    if (field.wire !== 2) throw new Error('expected message field');
    return concat([encodeVarint(field.number * 8 + 2), encodeVarint(next.length), next]);
  });
  return changed ? concat(parts) : bytes;
}

function cleanPage(bytes, waterfall) {
  return rewrite(bytes, field => {
    if (field.number !== 5 || field.wire !== 2) return field.value;
    const group = fields(field.value);
    const template = valueOf(group, 3);
    if (!waterfall) {
      const advert = group.some(f => f.number === 37 && f.wire === 2 && matchesAscii(f.value, 'ADVERT'));
      // 商城虚拟卡、机票直销、发现目的地、回归礼包；保留服务入口和飞行回忆。
      if (advert || [111288, 111281, 111326, 1296].includes(template)) return null;
    } else if (template === 111286) {
      // 保留机场概览和未来未知卡，过滤已确认的酒店、特价机票、租车、权益及内容推荐。
      return rewrite(field.value, card => {
        if (card.number !== 8 || card.wire !== 2) return card.value;
        const id = valueOf(fields(card.value), 2);
        return [306222, 306379, 306214, 306225, 306219, 306244, 306220, 306245].includes(id) ? null : card.value;
      });
    }
    return field.value;
  });
}

function cleanEnvelope(bytes, rpid) {
  const envelope = fields(bytes);
  if (!envelope.some(f => f.number === 5 && f.wire === 2 && matchesAscii(f.value, rpid))) return bytes;
  // 1000002: 7.1.2.5 首页组；1000029: 7.1.1.5 瀑布流组。
  return rewrite(bytes, outer => outer.number === 7 && outer.wire === 2
    ? rewrite(outer.value, payload => payload.number === 1 && payload.wire === 2
      ? rewrite(payload.value, page => page.number === (rpid === '1000002' ? 2 : 1) && page.wire === 2
        ? cleanPage(page.value, rpid === '1000029') : page.value)
      : payload.value)
    : outer.value);
}

function main() {
  const headers = $request.headers || {};
  const key = Object.keys(headers).find(key => key.toLowerCase() === 'rpid');
  const rpid = headers[key];
  const native = /^https?:\/\/(home\.umetrip\.com|umehome\.umetrip\.com|sns\.umetrip\.com|opactivity\.umetrip\.com|114\.115\.217\.129)\/gateway\/api\/umetrip\/native(?:\?[^#]*)?$/i.exec($request.url || '');
  if (!native || typeof rpid !== 'string') return {};
  const host = native[1].toLowerCase();
  if (rpid === '1000019' && ['home.umetrip.com', 'umehome.umetrip.com', 'sns.umetrip.com', '114.115.217.129'].includes(host)) {
    return { status: 'HTTP/1.1 404 Not Found' };
  }
  const home = rpid === '1000002' && ['home.umetrip.com', 'umehome.umetrip.com', '114.115.217.129'].includes(host);
  const waterfall = rpid === '1000029' && host === 'opactivity.umetrip.com';
  if (!home && !waterfall) return {};
  const body = $response.body;
  if (!(body instanceof Uint8Array) && !(body instanceof ArrayBuffer)) return {};
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  const cleaned = cleanEnvelope(bytes, rpid);
  return cleaned === bytes ? {} : { body: cleaned };
}

let result;
try { result = main(); } catch (_) { result = {}; }
$done(result);
