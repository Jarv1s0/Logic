import {asBytes, fromUtf8, utf8, safeJson, finalizeHeaders, MAX_BODY} from './vendor/data.mjs';
import {editBinary, editJson} from './vendor/edit.mjs';
import {unpackHttp} from './vendor/body.mjs';
import {same} from './vendor/wire.mjs';
import {settings} from './settings.mjs';

export function editApi(request, response, options) {
  const endpoint = /\/youtubei\/v1\/(browse|next|search|guide|navigation\/resolve_url)(?:\?|$)/.exec(request.url || '')?.[1];
  if (!endpoint || Number(response.status ?? response.statusCode) !== 200) return null;
  const s = settings(options);
  // API subtitles and playback remain in the existing handlers. This editor
  // only adds the feed templates, bounded envelopes and navigation policies.
  s.translate = false;
  const trace = s.debug ? {removed: 0, templates: new Set(), matchedAdTemplates: new Set(), unknown: new Set(), feedCards: 0} : null;
  try {
    const bytes = asBytes(response.body);
    if (!bytes.length || bytes.length > MAX_BODY) return null;
    const plain = unpackHttp(bytes, MAX_BODY).bytes;
    let output;
    if (/^\s*\{/.test(fromUtf8(plain.subarray(0, 40)))) {
      const json = safeJson(fromUtf8(plain)), changes = {changed: false};
      editJson(json, s, undefined, trace, changes);
      output = changes.changed ? utf8(JSON.stringify(json)) : plain;
    } else output = editBinary(plain, endpoint, s, undefined, trace);
    const changed = !same(output, plain);
    if (trace) console.log('[YouTube] ' + JSON.stringify({endpoint, changed, removed: trace.removed,
      templates: [...trace.matchedAdTemplates], envelopeNodes: trace.feedEnvelopeNodes || 0,
      envelopeBypasses: trace.feedEnvelopeBypasses || 0}));
    return changed ? {body: output, headers: finalizeHeaders(response.headers)} : null;
  } catch {
    if (trace) console.log('[YouTube] ' + JSON.stringify({endpoint, changed: false, reason: 'api-pass-through'}));
    return null;
  }
}
