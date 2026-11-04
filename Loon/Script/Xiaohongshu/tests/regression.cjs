// 合成响应验证：字段及嵌套结构参考 fmz200/wool_scripts 的图片详情处理。
// 不代表已验证当前小红书客户端的实际响应或相册保存结果。
// 图片详情结构：https://github.com/fmz200/wool_scripts/blob/4b7830670baf235ed945085cb926dc499cf619e0/Scripts/xiaohongshu/xiaohongshu.js
// watermark_pic_path：https://github.com/sve1r/Rules-For-Quantumult-X/blob/692aec6a28c0d7c1d44d69febb581632a8175e9f/Scripts/AdBlock/RedNote/RedNote.js
// node Loon/Script/Xiaohongshu/tests/regression.cjs [--baseline]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const relative = 'Loon/Script/Xiaohongshu/xiaohongshu.js';
const source = process.argv.includes('--baseline')
  ? cp.execFileSync('git', ['show', `HEAD:${relative}`], { encoding: 'utf8' })
  : fs.readFileSync(path.join(__dirname, '..', 'xiaohongshu.js'), 'utf8');

const pluginSource = process.argv.includes('--baseline')
  ? cp.execFileSync('git', ['show', 'HEAD:Loon/xiaohognshu.lpx'], { encoding: 'utf8' })
  : fs.readFileSync(path.join(__dirname, '..', '..', '..', 'xiaohognshu.lpx'), 'utf8');
// --baseline 兼容旧版和新版 HEAD 中的规则声明。
const rules = [
  ...[...pluginSource.matchAll(/^http-response (\S+)/gm)].map(match => new RegExp(match[1], 'i')),
  ...[...pluginSource.matchAll(/^response if \$\{url\} ~= \/(.+)\/([ims]*) then script\(/gm)]
    .map(match => new RegExp(match[1], match[2]))
];
assert.equal(rules.length, 8, '必须读取全部信息流、详情和媒体规则');
function run(endpoint, input, store = new Map(), host = 'edith.xiaohongshu.com') {
  const url = `https://${host}/api/sns/${/^v\d+\//.test(endpoint) ? endpoint : `v6/${endpoint}`}?test=1`;
  assert.ok(rules.some(rule => rule.test(url)) || endpoint === 'unknown', `缺少拦截规则：${url}`);
  const body = typeof input === 'string' ? input : JSON.stringify(input);
  let result;
  let calls = 0;
  vm.runInNewContext(source, {
    $request: { url },
    $response: { body },
    $persistentStore: {
      read: key => store.get(key) || null,
      write: (value, key) => { store.set(key, value); return true; }
    },
    $done: response => { result = response.body; calls++; },
    console: { log() {} }
  });
  assert.equal(calls, 1);
  return typeof input === 'string' ? result : JSON.parse(result);
}
function note(id) {
  return { id, media_save_config: { disable_save: true, disable_watermark: false, keep: 1 },
    function_switch: [{ type: 'image_download', enable: false, reason: 'restricted' }],
    images_list: [{ url: 'https://example.com/image?imageView2/2/w/1080/format/jpg' }] };
}
function check(item, id) {
  assert.equal(item.id, id);
  assert.deepEqual(item.media_save_config, {
    disable_save: false, disable_watermark: true, disable_weibo_cover: true, keep: 1
  });
  assert.deepEqual(item.function_switch, [{ type: 'image_download', enable: true }]);
  assert.match(item.images_list[0].url, /\/w\/2160\//);
}
let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`通过：${name}`); }
  catch (error) { failures++; console.error(`失败：${name}\n${error.message}`); }
}
for (const endpoint of ['note/feed', 'note/imagefeed', 'note/videofeed']) {
  test(`${endpoint} 处理直接笔记列表`, () => {
    const output = run(endpoint, { data: [note('direct')] });
    check(output.data[0], 'direct');
  });
  test(`${endpoint} 处理所有 note_list 分组并保留分组字段`, () => {
    const output = run(endpoint, { data: [
      { cursor: 'a', note_list: [note('first'), { ads_info: {}, id: 'ad' }, note('second')] },
      { cursor: 'b', note_list: [note('third')] }
    ] });
    assert.equal(output.data.length, 2);
    assert.equal(output.data[0].cursor, 'a');
    assert.equal(output.data[1].cursor, 'b');
    check(output.data[0].note_list[0], 'first');
    assert.equal(output.data[0].note_list.length, 2);
    check(output.data[0].note_list[1], 'second');
    check(output.data[1].note_list[0], 'third');
  });
}
test('全局配置移除水印图片地址，保留无关配置', () => {
  assert.deepEqual(run('system_service/config', { data: { watermark_pic_path: 'https://example.com/watermark.png', keep: 1 } }),
    { data: { keep: 1 } });
});
test('缺失或异常字段保持原值，不中断其他笔记', () => {
  const unusual = [null, 1, 'text', { note_list: null }, { media_save_config: null }, { note_list: [null, {}] }];
  assert.deepEqual(run('note/feed', { data: unusual }), { data: unusual });
  assert.deepEqual(run('note/imagefeed', { data: { unknown: true } }), { data: { unknown: true } });
});
test('非法 JSON 原样透传', () => {
  assert.equal(run('note/feed', '{invalid'), '{invalid');
});
test('未涉及的响应内容保持不变', () => {
  const input = { data: [note('unchanged')] };
  assert.deepEqual(run('unknown', input), input);
});
function liveImage(id, streams = { h265: [{ master_url: `https://example.com/${id}.mp4?token=keep` }] }) {
  return { live_photo_file_id: id, live_photo: { media: { video_id: `video-${id}`, stream: streams } } };
}
function saveData(ids) {
  return { code: 0, success: true, data: { datas: ids.map(id => ({
    file_id: id, video_id: `video-${id}`, url: `https://example.com/${id}-watermark.mp4`, keep: 1
  })) } };
}
for (const endpoint of ['note/feed', 'note/imagefeed']) {
  test(`${endpoint} 跨脚本执行缓存实况流，仅替换匹配的保存记录`, () => {
    const store = new Map();
    run(endpoint, { data: [{ note_list: [{ images_list: [liveImage('a'), liveImage('b')] }] }] }, store);
    // 随后打开另一条笔记，不应把先前图片匹配到新笔记的流。
    run(endpoint, { data: [{ note_list: [{ images_list: [liveImage('c')] }] }] }, store);
    const input = saveData(['b', 'a', 'unknown']);
    const expected = structuredClone(input);
    expected.data.datas[0].url = 'https://example.com/b.mp4?token=keep';
    expected.data.datas[1].url = 'https://example.com/a.mp4?token=keep';
    assert.deepEqual(run('note/live_photo/save', input, store), expected);
  });
}
test('实况流支持 H264 回退及空 URL 替换', () => {
  const store = new Map();
  run('note/feed', { data: [{ images_list: [liveImage('a', {
    h265: [null, { master_url: '' }], h264: [{ master_url: 'https://example.com/a.mov?sign=keep' }]
  })] }] }, store);
  const input = saveData(['a']);
  input.data.datas[0].url = '';
  assert.equal(run('note/live_photo/save', input, store).data.datas[0].url, 'https://example.com/a.mov?sign=keep');
});
test('重新打开笔记后使用最新流地址，支持下载记录只有 file_id', () => {
  const store = new Map();
  for (const token of ['old', 'new']) {
    run('note/imagefeed', { data: [{ images_list: [liveImage('a', {
      h265: [{ master_url: `https://example.com/a.mp4?token=${token}` }]
    })] }] }, store);
  }
  const input = saveData(['a']);
  delete input.data.datas[0].video_id;
  assert.equal(run('note/live_photo/save', input, store).data.datas[0].url, 'https://example.com/a.mp4?token=new');
});
test('Loon 分发规则实际覆盖实况保存接口', () => {
  for (const host of ['edith.xiaohongshu.com', 'edith.rnote.com']) {
    assert.ok(rules.some(rule => rule.test(`https://${host}/api/sns/v1/note/live_photo/save?test=1`)));
  }
});
test('视频标识冲突、无流、缺缓存时保留原记录', () => {
  const store = new Map();
  run('note/feed', { data: [{ images_list: [liveImage('a'), liveImage('b', {}), liveImage('c', {
    h265: [{ master_url: 'javascript:invalid' }]
  })] }] }, store);
  const input = saveData(['a', 'b', 'c', 'unknown']);
  input.data.datas[0].video_id = 'different-video';
  assert.deepEqual(run('note/live_photo/save', input, store), input);
  assert.deepEqual(run('note/live_photo/save', saveData(['a'])), saveData(['a']));
});
test('缓存损坏或存储异常时保留下载响应，详情仍正常解锁', () => {
  const broken = { get: () => '{invalid', set() { throw new Error('storage failed'); } };
  assert.deepEqual(run('note/live_photo/save', saveData(['a']), broken), saveData(['a']));
  const item = note('normal');
  item.images_list.push(liveImage('a'));
  check(run('note/feed', { data: [item] }, broken).data[0], 'normal');
  const denied = { get() { throw new Error('read failed'); } };
  assert.deepEqual(run('note/live_photo/save', saveData(['a']), denied), saveData(['a']));
});
test('实况下载不伪造缺失数据或成功状态', () => {
  for (const input of [{ code: -1, success: false }, { data: {} }, { data: { datas: [null, {}, { url: 'keep' }] } }]) {
    assert.deepEqual(run('note/live_photo/save', input), input);
  }
});
function streams(id) {
  return { h265: [
    { master_url: `https://example.com/${id}-low.mp4`, width: 720, height: 1280, avg_bitrate: 500 },
    { master_url: `https://example.com/${id}-hd.mp4?sign=keep`, width: 1080, height: 1920, avg_bitrate: 1000 },
    { master_url: `https://example.com/${id}-lower-bitrate.mp4`, width: 1080, height: 1920, avg_bitrate: 800 }
  ] };
}
test('普通视频跨请求匹配笔记，选取高清流并解除保存限制', () => {
  const store = new Map();
  run('v4/note/videofeed', { data: ['a', 'b'].map(id => ({ id, video_info_v2: { media: { stream: streams(id) } } })) }, store);
  const input = { code: 0, success: true, data: { note_id: 'a', download_url: 'watermark', disable: true, msg: 'restricted', status: 0, keep: 1 } };
  assert.deepEqual(run('v10/note/video/save', input, store), { code: 0, success: true, data: {
    note_id: 'a', download_url: 'https://example.com/a-hd.mp4?sign=keep', status: 2, keep: 1
  } });
  const unknown = { data: { note_id: 'unknown', download_url: 'keep', disable: true } };
  assert.deepEqual(run('v10/note/video/save', unknown, store), unknown);
});
test('评论实况与子评论视频混合缓存，按视频标识独立匹配', () => {
  const store = new Map();
  const info = id => JSON.stringify({ stream: streams(id) });
  run('v5/note/comment/list', { data: { comments: [{
    pictures: [{ video_id: 'live', video_info: info('live') }],
    sub_comments: [{ videos: [{ video_id: 'video', video_info: info('video') }] }]
  }] } }, store);
  // 分页更新不能清掉前一页的媒体。
  run('v3/note/comment/sub_comments', { data: { comments: [{ videos: [{ video_id: 'other', video_info: info('other') }] }] } }, store);
  for (const id of ['live', 'video', 'other']) {
    const input = { data: { video: { video_id: id, video_url: 'watermark', keep: 1 } } };
    assert.deepEqual(run('v1/interaction/comment/video/download', input, store), {
      data: { video: { video_id: id, video_url: `https://example.com/${id}-hd.mp4?sign=keep`, keep: 1 } }
    });
  }
});
test('媒体缓存损坏、无匹配或异常 video_info 时透传，不中断其他评论', () => {
  const store = new Map();
  const comments = [{ comment_type: 3, pictures: [{ video_id: 'bad', video_info: '{invalid' }],
    videos: [{ video_id: 'ok', video_info: JSON.stringify({ stream: { h264: [{ master_url: 'https://example.com/ok.mp4' }] } }) }] }];
  assert.equal(run('note/comment/list', { data: { comments } }, store).data.comments[0].comment_type, 2);
  assert.equal(run('v1/interaction/comment/video/download', { data: { video: { video_id: 'ok', video_url: 'old' } } }, store).data.video.video_url,
    'https://example.com/ok.mp4');
  const broken = { get: () => '{invalid' };
  for (const [endpoint, input] of [
    ['v10/note/video/save', { data: { note_id: 'missing', disable: true } }],
    ['v1/interaction/comment/video/download', { data: { video: { video_id: 'missing', video_url: 'keep' } } }]
  ]) assert.deepEqual(run(endpoint, input, broken), input);
});
test('已知笔记的接口失败响应不会改写成下载成功', () => {
  const store = new Map();
  run('note/videofeed', { data: [{ id: 'a', video_info_v2: { media: { stream: streams('a') } } }] }, store);
  const input = { code: -1, success: false, data: { note_id: 'a', disable: true, status: 0 } };
  assert.deepEqual(run('v10/note/video/save', input, store), input);
});
for (const endpoint of ['v4/followfeed', 'v1/user/followings/followfeed']) {
  test(`${endpoint} 清理推荐用户并保留普通条目及分页字段`, () => {
    const normal = { id: 'normal', recommend_reason: 'friend_post' };
    const unknown = { id: 'unknown' };
    assert.deepEqual(run(endpoint, { data: { cursor: 'next', items: [normal, unknown, { recommend_reason: 'recommend_user' }, { ads_info: {} }] } }),
      { data: { cursor: 'next', items: [normal, unknown] } });
  });
}
for (const host of ['so.xiaohongshu.com', 'so.rnote.com']) {
  test(`${host} 搜索过滤广告且保留普通笔记`, () => {
    const normal = { model_type: 'note', id: 'normal' };
    assert.deepEqual(run('search/notes', { data: { items: [normal, { model_type: 'note', ads_info: {} }, { model_type: 'ad' }] } }, new Map(), host),
      { data: { items: [normal] } });
  });
}
process.exitCode = failures ? 1 : 0;
