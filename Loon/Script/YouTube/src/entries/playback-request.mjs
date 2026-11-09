import {YouTubePlayback} from '../legacy/request-YouTubePlayback.mjs';
import {runLegacy, options, completion} from '../legacy-runtime.mjs';
import {syncLogging} from '../log-control.mjs';
const done = completion(), args = options();
try { syncLogging(args); runLegacy(YouTubePlayback, args, undefined, done); }
catch { done({}); }
