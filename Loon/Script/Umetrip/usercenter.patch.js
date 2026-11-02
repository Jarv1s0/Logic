/* 航旅个人页资源响应补丁；GPL-3.0，见 LICENSE。只在内存中修改客户端资源。 */
const usercenterRenderStart = 'render:function(){var t=this,e=t.$createElement,A=t._self._c||e;return A("div",{ref:"indexWrapper"';
const usercenterRenderEnd = '},staticRenderFns:[]}';

function renderBounds(source) {
  const start = source.indexOf(usercenterRenderStart);
  if (start < 0 || source.indexOf(usercenterRenderStart, start + 1) >= 0) throw new Error('unknown personal page render');
  const end = source.indexOf(usercenterRenderEnd, start);
  if (end < 0) throw new Error('missing render end');
  return [start, end + usercenterRenderEnd.length];
}

// 定位已知创建节点调用，跳过字符串中的括号；未知模板不盲目替换。
function removeRenderCall(render, needle) {
  const start = render.indexOf(needle);
  if (start < 0 || render.indexOf(needle, start + 1) >= 0) throw new Error('unknown render node');
  let quote = '', depth = 0;
  for (let i = start + 1; i < render.length; i++) {
    const char = render[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') depth++;
    if (char === ')' && --depth === 0) return render.slice(0, start) + 't._e()' + render.slice(i + 1);
  }
  throw new Error('unclosed render call');
}

function patchUsercenter(source) {
  const marker = '/* Logic usercenter 20261102-8 */';
  if (source.includes(marker)) return source;
  const previous = source.includes('/* Logic usercenter 20261102-6 */');
  source = source.replace('/* Logic usercenter 20261102-6 */', '');
  const [start, end] = renderBounds(source);
  let render = source.slice(start, end);
  if (!previous) {
    for (const component of ['NewMemberCard', 'NewMemberCardQ3', 'Sliderbanner', 'GiftCenterCard', 'TravelServiceCard']) {
      render = removeRenderCall(render, 'A("' + component + '",');
    }
    render = removeRenderCall(render, 'A("image",{staticClass:["hlLogo"]');
  }
  const walletTips = 'memberTips:t.memberTips';
  if (render.split(walletTips).length !== 2) throw new Error('unknown wallet member tips');
  render = render.replace(walletTips, 'memberTips:{}');
  return marker + source.slice(0, start) + render + source.slice(end);
}

// 资源清单的字段4为包MD5；仅支持抓包核实过的版本，不破坏未知新版的校验。
function md5Bytes(input) {
  const bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  bytes.set(input); bytes[input.length] = 128;
  const bits = input.length * 8;
  for (let i = 0; i < 8; i++) bytes[bytes.length - 8 + i] = Math.floor(bits / 2 ** (8 * i)) & 255;
  const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const shifts = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = [];
    for (let i = 0; i < 16; i++) {
      const p = offset + i * 4;
      words.push(bytes[p] | bytes[p+1] << 8 | bytes[p+2] << 16 | bytes[p+3] << 24);
    }
    let [a,b,c,d] = state;
    for (let i = 0; i < 64; i++) {
      const round = Math.floor(i / 16);
      const f = round === 0 ? (b & c) | (~b & d) : round === 1 ? (d & b) | (~d & c) : round === 2 ? b ^ c ^ d : c ^ (b | ~d);
      const g = round === 0 ? i : round === 1 ? (5*i+1)%16 : round === 2 ? (3*i+5)%16 : 7*i%16;
      const sum = (a + f + Math.floor(Math.abs(Math.sin(i+1))*2**32) + words[g]) | 0;
      const s = shifts[round*4+i%4];
      [a,b,c,d] = [d, (b + ((sum << s) | (sum >>> (32-s)))) | 0, b, c];
    }
    [a,b,c,d].forEach((v,i) => { state[i] = (state[i] + v) | 0; });
  }
  return state.map(v => [0,8,16,24].map(s => ((v >>> s) & 255).toString(16).padStart(2,'0')).join('')).join('');
}

function resourceHeaders() {
  const headers = Object.assign({}, $response.headers || {});
  for (const key of Object.keys(headers)) {
    if (/^(content-length|content-encoding|etag|content-md5|last-modified|accept-ranges|content-range|cache-control)$/i.test(key)) delete headers[key];
  }
  headers['Cache-Control'] = 'no-store';
  return headers;
}

function patchUsercenterResponse() {
  const url = $request.url || '';
  if (!/^https?:\/\/(?:user|static)\.umetrip\.com\/weex\/userCenter\/(?:userCenter\.wume|pages\/index\/entry\.js)(?:\?[^#]*)?$/.test(url)) return {};
  if (typeof $response === 'undefined') {
    const headers = Object.assign({}, $request.headers || {});
    for (const key of Object.keys(headers)) {
      if (/^(if-none-match|if-modified-since|if-range|range|cache-control)$/i.test(key)) delete headers[key];
    }
    headers['Cache-Control'] = 'no-cache';
    return { headers };
  }
  if (/\/userCenter\.wume(?:\?|$)/.test(url) && $request.method === 'HEAD') {
    const etag = Object.entries($response.headers || {}).find(([key]) => key.toLowerCase() === 'etag')?.[1];
    if (etag !== usercenterPackage.etag) return {};
    return { headers: Object.assign(resourceHeaders(), { 'Content-Length': String(usercenterPackage.size) }) };
  }
  if ($response.status === 206 || /\b206\b/.test(String($response.status || ''))) return {};
  const input = $response.body;
  if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) return {};
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let body;
  if (/\/userCenter\.wume(?:\?|$)/.test(url)) {
    const hash = md5Bytes(bytes);
    if (hash === usercenterPackage.md5) return { headers: Object.assign(resourceHeaders(), { 'Content-Length': String(bytes.length) }) };
    let total = 0;
    const archive = umetripZip.unzipSync(bytes, { filter: entry => {
      total += entry.originalSize;
      if (entry.originalSize > 8 * 1024 * 1024 || total > 16 * 1024 * 1024) throw new Error('resource too large');
      return true;
    }});
    const key = 'userCenter/pages/index/entry.js';
    if (!archive[key]) return {};
    const source = umetripZip.strFromU8(archive[key]);
    const patched = patchUsercenter(source);
    if (source === patched) return {};
    archive[key] = umetripZip.strToU8(patched);
    // ZIP 默认写入当前时间，会让相同内容每次产生不同MD5；固定时间保证与清单一致。
    body = umetripZip.zipSync(archive, { mtime: new Date(2026, 0, 1) });
    if (md5Bytes(body) !== usercenterPackage.md5 || body.length !== usercenterPackage.size) throw new Error('rebuilt package does not match manifest');
  } else {
    const source = umetripZip.strFromU8(bytes);
    const patched = patchUsercenter(source);
    if (source === patched) return {};
    body = umetripZip.strToU8(patched);
  }
  const headers = resourceHeaders();
  headers['Content-Length'] = String(body.length);
  console.log('[航旅个人页] 已移除6个推广渲染节点并校正资源校验，版本20261102-8');
  return { body, headers };
}

let usercenterResult;
try { usercenterResult = patchUsercenterResponse(); }
catch (error) {
  console.log('[航旅个人页] 资源未修改：' + error.message);
  usercenterResult = {};
}
$done(usercenterResult);
