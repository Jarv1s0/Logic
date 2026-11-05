/**
 * 航旅纵横；基于 fmz200/wool_scripts 的 umetrip_ads.js，GPL-3.0，见 LICENSE。
 * 上游：4b7830670baf235ed945085cb926dc499cf619e0。
 * 本地修改（20261105-1）：合并 xingjiu29/Umetrip 的模块识别及接口覆盖，
 * 过滤 HAR 确认的推广组，保留首页服务和未知字段；异常响应透传。
 * 参考：https://github.com/xingjiu29/Umetrip/blob/main/umetrip.js
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

// 在二进制消息中查找明确的 UTF-8 文案，不将整包误解码为文本。
function containsText(bytes, text) {
  const encoded = encodeURIComponent(text).match(/%[0-9A-F]{2}|./g).map(char => char[0] === '%' ? parseInt(char.slice(1), 16) : char.charCodeAt(0));
  return bytes.some((_, index) => index + encoded.length <= bytes.length && encoded.every((byte, i) => bytes[index + i] === byte));
}

function referenceTarget(bytes, group, mine) {
  if (mine) {
    // groupId 位于 JSON 配置中，与 Protobuf 字段3的模板编号不同。
    const ascii = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return /"groupId"\s*:\s*(?:111402|111403|111404)\s*[,}]/.test(ascii) ||
      containsText(bytes, '会员卡片') || (containsText(bytes, '我的页') && containsText(bytes, '腰部'));
  }
  const hasCard = group.some(field => [8, 32].includes(field.number) && field.wire === 2);
  return hasCard && ([111353, 111435, 111357, 111442, 10673].includes(valueOf(group, 2)) ||
    ['无行程机票直销卡片', '发现目的地', '本地服务标题', '新人券包'].some(text => containsText(bytes, text)));
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

function isMember(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.department === 'equity' || item.trackParam?.department === 'equity') return true;
  if (['title', 'serviceName', 'businessTitle'].some(key => typeof item[key] === 'string' && /会员|航旅会/.test(item[key]))) return true;
  return ['parameter', 'weexParams'].some(key => item[key] && /payMember|memberCardbag|memberequity\.umetrip\.com/i.test(JSON.stringify(item[key])));
}

function isAdvertising(item) {
  return item && typeof item === 'object' && (
    item.trackParam?.department === 'advert' ||
    (typeof item.serviceTrack === 'string' && /^advert_/.test(item.serviceTrack))
  );
}

function cleanChildren(item) {
  if (!item || typeof item !== 'object' || !Array.isArray(item.children)) return false;
  const indices = new Map();
  let changed = false;
  const kept = [];
  item.children.forEach((child, index) => {
    if (isMember(child) || isAdvertising(child)) { changed = true; return; }
    indices.set(index, kept.length);
    if (cleanChildren(child)) changed = true;
    kept.push(child);
  });
  if (!changed) return false;
  if (item.childrenIndex && typeof item.childrenIndex === 'object' && !Array.isArray(item.childrenIndex)) {
    for (const key of Object.keys(item.childrenIndex)) {
      const old = item.childrenIndex[key];
      if (!Number.isInteger(old) || old < 0 || old >= item.children.length) continue;
      if (indices.has(old)) item.childrenIndex[key] = indices.get(old);
      else delete item.childrenIndex[key];
    }
  }
  item.children = kept;
  return true;
}

function cleanServiceCard(bytes) {
  let blocked = false;
  const cleaned = rewrite(bytes, field => {
    if (field.number !== 7 || field.wire !== 2) return field.value;
    // Loon 环境无需 TextDecoder；仅解码已确认的 UTF-8 JSON 字段。
    let item;
    try { item = JSON.parse(decodeURIComponent(Array.from(field.value, byte => '%' + byte.toString(16).padStart(2, '0')).join(''))); }
    catch (_) { return field.value; }
    if (isMember(item) || isAdvertising(item)) { blocked = true; return field.value; }
    if (!cleanChildren(item)) return field.value;
    const encoded = encodeURIComponent(JSON.stringify(item));
    return new Uint8Array(encoded.match(/%[0-9A-F]{2}|./g).map(char => char[0] === '%' ? parseInt(char.slice(1), 16) : char.charCodeAt(0)));
  });
  return blocked ? null : cleaned;
}

function cleanPage(bytes, waterfall, mine = false, home = false) {
  return rewrite(bytes, field => {
    if (field.number !== 5 || field.wire !== 2) return field.value;
    const group = fields(field.value);
    const template = valueOf(group, 3);
    if ((mine || home) && referenceTarget(field.value, group, mine)) return null;
    if (!waterfall) {
      const advert = group.some(f => f.number === 37 && f.wire === 2 && matchesAscii(f.value, 'ADVERT'));
      // 商城虚拟卡、机票直销、发现目的地、回归礼包；保留服务入口和飞行回忆。
      if (advert || [111288, 111281, 111326, 1296].includes(template)) return null;
      // “我的”页：会员、礼金中心、广告条幅、票券权益及底部三个推广入口。
      if (mine && [1297, 111310, 111249, 111311, 111312].includes(template)) return null;
      const cleaned = rewrite(field.value, card => card.number === 8 && card.wire === 2 ? cleanServiceCard(card.value) : card.value);
      // 所有可见卡片均被过滤时移除空广告组，避免留下条幅占位。
      if (cleaned !== field.value && !fields(cleaned).some(card => card.number === 8 && card.wire === 2)) return null;
      return cleaned;
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
  // 会员页仅清空内容，保留外层协议状态；“我的”页及首页只删目标字段。
  return rewrite(bytes, outer => outer.number === 7 && outer.wire === 2
    ? rewrite(outer.value, payload => payload.number === 1 && payload.wire === 2
      ? rewrite(payload.value, page => {
        if (page.wire !== 2) return page.value;
        if (rpid === '1370286') return page.number === 2 ? null : page.value;
        if (rpid === '1000002' && page.number === 27) return null; // 会员权益图片配置
        const number = rpid === '1100001' ? 11 : rpid === '1000002' ? 2 : 1;
        return page.number === number ? cleanPage(page.value, rpid === '1000029', rpid === '1100001', rpid === '1000002') : page.value;
      })
      : payload.value)
    : outer.value);
}

function main() {
  const headers = $request.headers || {};
  const key = Object.keys(headers).find(key => key.toLowerCase() === 'rpid');
  const query = /[?&]rpid=([^&#]*)/i.exec($request.url || '');
  const rpid = typeof headers[key] === 'string' && headers[key].trim() || (query ? decodeURIComponent(query[1]).trim() : '');
  const native = /^https?:\/\/(114\.115\.217\.129|(?:home|umehome|umerp|sns|bkclient|appmsg)\.umetrip\.com(?:\.cn)?|(?:opactivity|activity)\.umetrip\.com)\/gateway\/api\/umetrip\/native(?:\?[^#]*)?$/i.exec($request.url || '');
  if (!native || typeof rpid !== 'string') return {};
  const host = native[1].toLowerCase();
  const referenceHost = /^(home|umehome|umerp|sns|bkclient|appmsg)\.umetrip\.com(?:\.cn)?$/.test(host);
  if (rpid === '1000019' && (referenceHost || host === '114.115.217.129')) {
    return { status: 'HTTP/1.1 404 Not Found' };
  }
  const home = rpid === '1000002' && (referenceHost || host === '114.115.217.129');
  const waterfall = rpid === '1000029' && host === 'opactivity.umetrip.com';
  const member = ['1100001', '1370286'].includes(rpid) && referenceHost;
  const empty = ['1420002', '1430064'].includes(rpid) && referenceHost;
  const tripBanner = rpid === '1370126' && host === 'activity.umetrip.com';
  if (!home && !waterfall && !member && !tripBanner && !empty) return {};
  const body = $response.body;
  if (!(body instanceof Uint8Array) && !(body instanceof ArrayBuffer)) return {};
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  // 参考脚本的空载荷结构；要求协议内 rpid 与请求一致，避免处理错误业务响应。
  const cleaned = empty
    ? (fields(bytes).some(field => field.number === 5 && field.wire === 2 && matchesAscii(field.value, rpid))
      ? rewrite(bytes, field => {
        if (field.number !== 7 || field.wire !== 2) return field.value;
        const page = new Uint8Array([10, 0, 16, 0, 32, 0]);
        return field.value.length === page.length && page.every((byte, i) => field.value[i] === byte) ? field.value : page;
      })
      : bytes)
    : cleanEnvelope(bytes, rpid);
  return cleaned === bytes ? {} : { body: cleaned };
}

let result;
try { result = main(); } catch (_) { result = {}; }
$done(result);
