import {YouTubeFeed} from '../legacy/response-YouTubeFeed.mjs';
import {runLegacy, options, completion} from '../legacy-runtime.mjs';
import {editApi} from '../api.mjs';
import {finalizeHeaders} from '../vendor/data.mjs';
const done = completion(), args = options();
try {
  if (typeof $response === 'undefined') done({});
  else {
    const extra = editApi($request, $response, args);
    const response = extra ? {...$response, ...extra} : $response;
    if (/\/youtubei\/v1\/(?:browse|next|search)(?:\?|$)/.test($request.url || ''))
      runLegacy(YouTubeFeed, args, response, result => {
        if (result?.body != null) done({...extra, ...result, headers: finalizeHeaders({...response.headers, ...result.headers})});
        else done(extra || result);
      });
    else done(extra || {});
  }
} catch { done({}); }
