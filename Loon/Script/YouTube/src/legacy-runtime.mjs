// Loon adapter for the previously vendored devchristian1337 handlers.
// A scoped input lets the new API editor and the existing feed filter run once
// in order, without mutating host globals or calling $done between the stages.
let context;
export function runLegacy(handler, options, response, done, extra) {
  const previous = context;
  context = {response, done};
  try { return handler(options, extra); }
  finally { context = previous; }
}
export function ytRuntimeInvoke(handler, options) {
  const current = context;
  return handler(typeof $request === 'undefined' ? undefined : $request,
    current?.response, options || {},
    typeof $persistentStore === 'undefined' ? undefined : $persistentStore,
    current?.done || $done);
}
export function options() {
  if (typeof $argument === 'undefined' || !$argument) return {};
  if (typeof $argument === 'object' && !Array.isArray($argument)) return $argument;
  if (typeof $argument === 'string' && $argument.trim().startsWith('{')) {
    try { return JSON.parse($argument) || {}; } catch { return {}; }
  }
  const out = {};
  for (const item of String($argument).split('&')) {
    const at = item.indexOf('=');
    if (at < 1) continue;
    try {
      const key = decodeURIComponent(item.slice(0, at));
      if (/^[a-z][a-z0-9_]*$/.test(key) && key !== 'constructor' && key !== 'prototype')
        out[key] = decodeURIComponent(item.slice(at + 1).replace(/\+/g, '%20'));
    } catch {}
  }
  return out;
}
export const enabled = value => value === true || value === 'true';
export function completion() {
  let finished = false;
  return result => { if (!finished) { finished = true; $done(result || {}); } };
}
