// 合成响应回归验证，不代表已验证微博客户端的实际响应结构。
// node Loon/Script/Weibo/tests/regression.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const old = process.argv.includes('--baseline');

function run(file, endpoint, input) {
  const relative = `Loon/Script/Weibo/${file}`;
  const source = old
    ? cp.execFileSync('git', ['show', `HEAD:${relative}`], { encoding: 'utf8' })
    : fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  let result;
  const logs = [];
  vm.runInNewContext(source, {
    $request: { url: `https://api.weibo.cn/2/${endpoint}?test=1` },
    $response: { body: JSON.stringify(input) },
    $loon: {},
    $persistentStore: { read: () => null, write: () => true },
    $done: (response) => { result = JSON.parse(response.body); },
    console: { log: (...args) => logs.push(args.join(' ')) }
  });
  assert.ok(result, '脚本必须返回响应');
  assert.equal(logs.some((line) => line.includes('脚本运行出现错误')), false, logs.join('\n'));
  return result;
}

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`通过：${name}`);
  } catch (error) {
    failures++;
    console.error(`失败：${name}\n${error.message}`);
  }
}

const feed = { category: 'feed', data: { card_type: 9, text: '正常微博' } };
const topic = { category: 'card', data: { card_type: 182, title: '热议话题' } };
function payload() {
  return {
    items: [
      { type: 'vertical', items: [{ data: { card_type: 17, group: [
        { itemid: 'normal' }, { itemid: 'is_ad_pos' }, { promotion: { type: 'ad' } }
      ] } }] },
      { type: 'vertical', items: [feed, topic, { data: { card_type: 118 } }] },
      { category: 'feed', data: { ad_state: '1' } },
      { data: { card_type: 999, title: '未知正常模块' } }
    ]
  };
}
function checkPayload(output) {
  assert.deepEqual(output.items[1].items, [feed, topic]);
  assert.equal(output.items.length, 3);
  assert.equal(output.items[2].data.card_type, 999);
  assert.deepEqual(output.items[0].items[0].data.group, [{ itemid: 'normal' }]);
}

for (const endpoint of ['search/container_timeline', 'search/container_discover']) {
  test(`${endpoint} 保留正常内容并删除嵌套广告`, () => {
    checkPayload(run('weibo_ads.js', endpoint, payload()));
  });
}
test('首次发现页处理多个频道，标题样式缺失不会中断', () => {
  const output = run('weibo_ads.js', 'search/finder', {
    channelInfo: { channels: [{ id: 1001, payload: payload() }, { id: 1015, payload: payload() }] }
  });
  assert.equal(output.channelInfo.channels.length, 2);
  output.channelInfo.channels.forEach((channel) => checkPayload(channel.payload));
});
test('新版 key/pageId 频道缺少 id 时保留发现流和其他频道', () => {
  const output = run('weibo_ads.js', 'search/finder', {
    channelInfo: { channels: [
      { key: 'discover_channel', pageId: '102803_ctg1_1780_-_ctg1_1780', payload: payload() },
      { key: 'star_product_channel', pageId: '232727_1_heroProduct' }
    ] }
  });
  assert.equal(output.channelInfo.channels.length, 2);
  assert.equal(output.channelInfo.channels[0].key, 'discover_channel');
  checkPayload(output.channelInfo.channels[0].payload);
});
test('空发现页响应不会中断', () => {
  assert.deepEqual(run('weibo_ads.js', 'search/container_discover', { items: [] }), { items: [] });
});
test('顶部热搜过滤保留热门微博，兼容字符串类型与嵌套分组', () => {
  const output = run('weibo_ads.js', 'search/container_timeline', {
    items: [{ category: 'feed', data: { text: '正常微博' } }], header: { data: { items: [{ type: 'vertical', items: [
      { data: { card_type: '235', channel_list: [] } },
      { data: { card_type: 101, title: '热门微博' } }
    ] }] } }
  });
  assert.deepEqual(output.header.data.items[0].items, [{ data: { card_type: 101, title: '热门微博' } }]);
});

for (const endpoint of ['profile/me', 'profile/container_timeline']) {
  test(`${endpoint} 删除目标推广、保留普通模块与微博正文`, () => {
    const normal = { itemId: '100505_-_top8', type: 'grid', items: [{ title: '我的相册' }] };
    const ordinary = { header: { title: { content: '普通服务' } } };
    const post = { category: 'feed', data: { text: 'AI角色伴聊', title: 'AI角色伴聊' } };
    const output = run('weibo_main.js', endpoint, { items: [
      normal,
      { category: 'group', items: [
        { header: { title: { content: 'AI角色伴聊' } } },
        { data: { title: { text: '造浪吧国庆档' } } }
      ] },
      { items: [{ title: 'AI角色' }, ordinary] },
      { data: { desc: '造浪吧！国庆檔' } },
      post
    ] });
    assert.deepEqual(output.items, [normal, { items: [ordinary] }, post]);
  });
}
test('普通模块标题提及 AI 角色不会被模糊匹配删除', () => {
  const input = { items: [{ title: '我的AI角色创作记录' }] };
  assert.deepEqual(run('weibo_main.js', 'profile/me', input), input);
});

process.exitCode = failures ? 1 : 0;
