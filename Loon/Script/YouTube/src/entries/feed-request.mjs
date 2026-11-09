import {options, completion, enabled, runLegacy} from '../legacy-runtime.mjs';
import {syncLogging} from '../log-control.mjs';
import {YouTubeLogger} from '../legacy/request-YouTubeLogger.mjs';
const done = completion(), args = options();
try {
  syncLogging(args);
  let result = {};
  // guide may otherwise return a cached, unedited bottom bar after toggling.
  if (enabled(args.hide_upload) || enabled(args.hide_bottom_shorts)) {
    const headers = {};
    for (const [key, value] of Object.entries($request.headers || {}))
      if (!['if-none-match', 'if-modified-since'].includes(key.toLowerCase())) headers[key] = value;
    headers['Cache-Control'] = 'no-cache';
    result = {headers};
  }
  if (enabled(args.log_enabled)) runLegacy(YouTubeLogger, args, undefined, logged => done({...logged, ...result}));
  else done(result);
} catch { done({}); }
