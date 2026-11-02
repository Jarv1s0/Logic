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
  const marker = '/* Logic usercenter 20261102-6 */';
  if (source.includes(marker)) return source;
  const [start, end] = renderBounds(source);
  let render = source.slice(start, end);
  for (const component of ['NewMemberCard', 'NewMemberCardQ3', 'Sliderbanner', 'GiftCenterCard', 'TravelServiceCard']) {
    render = removeRenderCall(render, 'A("' + component + '",');
  }
  render = removeRenderCall(render, 'A("image",{staticClass:["hlLogo"]');
  return marker + source.slice(0, start) + render + source.slice(end);
}

function patchUsercenterResponse() {
  const url = $request.url || '';
  if (!/^https?:\/\/user\.umetrip\.com\/weex\/userCenter\/(?:userCenter\.wume|pages\/index\/entry\.js)(?:\?[^#]*)?$/.test(url)) return {};
  const input = $response.body;
  if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) return {};
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let body;
  if (/\/userCenter\.wume(?:\?|$)/.test(url)) {
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
    body = umetripZip.zipSync(archive);
  } else {
    const source = umetripZip.strFromU8(bytes);
    const patched = patchUsercenter(source);
    if (source === patched) return {};
    body = umetripZip.strToU8(patched);
  }
  const headers = Object.assign({}, $response.headers || {});
  for (const key of Object.keys(headers)) {
    if (/^(content-length|content-encoding|etag|content-md5)$/i.test(key)) delete headers[key];
  }
  console.log('[航旅个人页] 已移除6个推广渲染节点，版本20261102-6');
  return { body, headers };
}

let usercenterResult;
try { usercenterResult = patchUsercenterResponse(); }
catch (error) {
  console.log('[航旅个人页] 资源未修改：' + error.message);
  usercenterResult = {};
}
$done(usercenterResult);
