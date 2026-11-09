import {YouTubeLogger} from '../legacy/request-YouTubeLogger.mjs';
import {runLegacy, options, completion} from '../legacy-runtime.mjs';
import {syncLogging} from '../log-control.mjs';
const done = completion(), args = options();
try { syncLogging(args); runLegacy(YouTubeLogger, args, typeof $response === 'undefined' ? undefined : $response, done); }
catch { done({}); }
