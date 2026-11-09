import {handleCaption} from '../vendor/captions.mjs';
import {asBytes, finalizeHeaders, MAX_CAPTION, route} from '../vendor/data.mjs';
import {settings} from '../settings.mjs';
import {options, completion} from '../legacy-runtime.mjs';
const done = completion(), args = options();
const internal = 'X-YouTubeClean-Internal';
async function download(url, headers) {
  let timer;
  try {
    return await Promise.race([
      new Promise((resolve, reject) => $httpClient.get({url, headers, timeout: 4000,
        'binary-mode': true, 'auto-cookie': false, 'auto-redirect': false, insecure: false},
      (error, response, body) => {
        if (error || !response) return reject(Error('caption connection'));
        try {
          if (Number(response.status ?? response.statusCode) === 200 && asBytes(body).length > MAX_CAPTION) throw Error('caption size');
          resolve({status: response.status ?? response.statusCode, headers: response.headers || {}, body});
        } catch (error) { reject(error); }
      })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('caption timeout')), 4000); })
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
async function execute() {
  if (typeof $response === 'undefined' || route($request.url)?.kind !== 'caption' ||
      Object.keys($request.headers || {}).some(key => key.toLowerCase() === internal.toLowerCase())) return {};
  const s = settings(args), diagnostic = {};
  const result = await handleCaption({url: $request.url, status: $response.status ?? $response.statusCode,
    requestHeaders: $request.headers || {}, responseHeaders: $response.headers || {}, body: $response.body,
    download, captionRecovery: true,
    store: {
      read(key) { try { return JSON.parse($persistentStore.read(key) || 'null'); } catch { return null; } },
      write(key, value) { return $persistentStore.write(JSON.stringify(value), key); }
    }
  }, s, diagnostic, internal);
  if (s.debug) console.log('[YouTube] ' + JSON.stringify({endpoint: 'timedtext', reason: diagnostic.reason, mode: diagnostic.captionMode}));
  return result?.body ? {...result, headers: finalizeHeaders($response.headers, result.headers)} : {};
}
execute().then(done, () => done({}));
