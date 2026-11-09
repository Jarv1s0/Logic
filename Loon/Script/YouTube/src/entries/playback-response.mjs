import {YouTubePlayback} from '../legacy/response-YouTubePlayback.mjs';
import {runLegacy, options, completion} from '../legacy-runtime.mjs';
const done = completion();
try { runLegacy(YouTubePlayback, options(), typeof $response === 'undefined' ? undefined : $response, done); }
catch { done({}); }
