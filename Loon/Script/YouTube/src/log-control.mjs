import {YouTubeLogger} from './legacy/request-YouTubeLogger.mjs';
import {runLegacy, enabled} from './legacy-runtime.mjs';

// Preserve the old Loon start/stop lifecycle on request lanes. Responses record
// through their own existing handlers and need not load the log-page renderer.
export function syncLogging(options) {
  if (typeof $persistentStore === 'undefined' || typeof $request === 'undefined') return;
  const url = String($request.url || '');
  const api = /^https:\/\/(?:youtubei(?:-att)?\.googleapis\.com|(?:www\.|m\.|music\.)?youtube\.com)(?::443)?\/youtubei\/v1\//i.test(url);
  const page = /^http:\/\/youtube-logs\.invalid(?::80)?\/?(?:\?[^#]*)?$/.test(url);
  const media = enabled(options.log_enabled) && /^https:\/\/[\w-]+\.googlevideo\.com\//i.test(url);
  if (!api && !page && !media) return;
  const key = 'ytads.logger.loon-control.v1';
  try {
    let state = $persistentStore.read(key);
    const command = path => {
      let result;
      runLegacy(YouTubeLogger, {log_enabled: true}, undefined, () => {},
        {path, done: value => { result = value?.response; }});
      return result;
    };
    if (!enabled(options.log_enabled)) {
      if (state !== 'on' && state !== 'pending') return;
      if (command('/clear')?.status === 303) $persistentStore.write('off', key);
      return;
    }
    if (state !== 'on' && state !== 'pending') {
      if (command('/start')?.status !== 303 || $persistentStore.write('pending', key) !== true) return;
      state = 'pending';
    }
    if (state === 'pending' && !page && $persistentStore.write('on', key) === true && typeof $notification !== 'undefined')
      $notification.post('YouTube 日志', '日志工具已开启', '点击打开日志页面。关闭日志后，下次命中 API 会清除记录。', {openUrl: 'http://youtube-logs.invalid/'});
  } catch {}
}
