import {YouTubeConfig} from '../legacy/request-YouTubeConfig.mjs';
import {runLegacy, options, completion} from '../legacy-runtime.mjs';
const done = completion();
try { runLegacy(YouTubeConfig, options(), typeof $response === 'undefined' ? undefined : $response, done); }
catch { done({}); }
