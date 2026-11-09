import {YouTubeConfig} from '../legacy/request-YouTubeConfig.mjs';
import {runLegacy, options, completion} from '../legacy-runtime.mjs';
import {syncLogging} from '../log-control.mjs';
const done = completion(), args = options();
try { syncLogging(args); runLegacy(YouTubeConfig, args, undefined, done); }
catch { done({}); }
