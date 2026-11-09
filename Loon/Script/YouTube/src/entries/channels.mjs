import {YouTubeChannelList} from '../legacy/request-YouTubeChannelList.mjs';
import {runLegacy, options, completion} from '../legacy-runtime.mjs';
const done = completion();
try { runLegacy(YouTubeChannelList, options(), undefined, done); }
catch { done({}); }
