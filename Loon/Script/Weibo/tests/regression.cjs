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
    $request: { url: (endpoint.startsWith("https://") ? endpoint : `https://api.weibo.cn/2/${endpoint}?test=1`) },
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
for (const endpoint of ['search/finder', 'search/container_timeline', 'search/container_discover']) {
  test(`${endpoint} 保留顶部热搜列表、标题和正常条目，仅过滤广告`, () => {
    const normal = { itemid: 'normal', word: '正常热搜' };
    const groups = [normal, { itemid: 'is_ad_pos' }, { promotion: { type: 'ad' } }];
    const title = { data: { card_type: 101, title: '微博热搜' } };
    const input = { items: [feed], header: { data: { items: [{ type: 'vertical', items: [
      title,
      { data: { card_type: 17, group: groups, group_unfold: groups } },
      { data: { card_type: '235', channel_list: [{ group: groups, group_unfold: groups }] } },
      { data: { card_type: 118 } }
    ] }] } } };
    const output = run('weibo_ads.js', endpoint, input);
    assert.deepEqual(output.header.data.items[0].items, [
      title,
      { data: { card_type: 17, group: [normal], group_unfold: [normal] } },
      { data: { card_type: '235', channel_list: [{ group: [normal], group_unfold: [normal] }] } }
    ]);
    assert.deepEqual(output.items, [feed]);
    assert.deepEqual(run('weibo_ads.js', endpoint, output), output);
  });
}

for (const endpoint of ['search/finder', 'search/container_timeline', 'search/container_discover']) {
  test(`${endpoint} 过滤 BigDay 六宫格，保留普通和混合频道入口`, () => {
    const normal = { title_sub: '普通频道', itemid: 'category:1001', scheme: 'sinaweibo://searchall?q=i6' };
    const unrelated = { itemid: 'category:1001&not_adid=bigday_1810&' };
    const ads = Array.from({ length: 6 }, (_, index) => ({
      title_sub: '', itemid: `type:ctg1|pos:1-0-${index}|ext:&cate=1001&adid=bigday_1810&mod_src=s_finder&`
    }));
    const input = { header: { data: { items: [
      { data: { card_type: 19, itemid: 'finder_channel', group: ads } },
      { data: { card_type: '19', group: [normal, ...ads, { action_log: { ext: 'adid:bigday_1810|pos:1' } }, unrelated] } },
      { data: { card_type: 19, group: [normal] } }
    ] } } };
    const output = run('weibo_ads.js', endpoint, input);
    assert.deepEqual(output.header.data.items, [
      { data: { card_type: '19', group: [normal, unrelated] } },
      { data: { card_type: 19, group: [normal] } }
    ]);
    assert.deepEqual(run('weibo_ads.js', endpoint, output), output);
  });
}

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


for (const endpoint of ['video/tiny_stream_video_list', 'video/tiny_stream_mid_detail', 'statuses/video_mixtimeline']) {
  test(`${endpoint} 过滤广告及购物红包，保留正常视频和续播列表`, () => {
    const output = run('weibo_main.js', endpoint, { statuses: [
      { id: 1, video_info: { title: '普通视频', shopping: {}, float_info: {}, tags: [], forward_redpacket_info: {} } },
      { id: 2, page_info: { actionlog: { source: 'ad' } } },
      { id: 3, ad_state: 1 }, { id: 4 }
    ], tab_list: [1] });
    assert.deepEqual(output, { statuses: [{ id: 1, video_info: { title: '普通视频' } }, { id: 4 }], tab_list: [1] });
  });
}
for (const endpoint of ['guest/timeline', 'guest/statuses_unread_hot_timeline']) {
  test(`${endpoint} 过滤未登录信息流广告`, () => {
    const output = run('weibo_main.js', endpoint, { statuses: [{ id: 1 }, { id: 2, ad_state: 1 }] });
    assert.deepEqual(output.statuses, [{ id: 1 }]);
  });
}
test('旧版未读超话保留正常帖子与卡片，过滤广告和未关注帖子', () => {
  const normal = { mblog: { id: 1 } }, card = { card_type: 17 };
  const output = run('weibo_main.js', 'statuses/unread_topic_timeline', { cards: [normal, card,
    { mblog: { ad_state: 1 } }, { mblog: { buttons: [{ type: 'follow' }] } }
  ] });
  assert.deepEqual(output.cards, [normal, card]);
});
for (const endpoint of ['statuses/container_detail', 'statuses/container_detail_comment', 'statuses/container_detail_mix']) {
  test(`${endpoint} 过滤推荐及 AI 卡片，保留普通评论与未知结构`, () => {
    const normal = { type: 'comment', data: { text: '正常评论' } };
    const output = run('weibo_ads.js', endpoint, { items: [normal, {},
      { data: { adType: '廣告' } }, { data: { card_type: 236 } },
      { data: { card_type: 6 } }, { type: 'trend' }, { commentAdType: 1 }
    ], tip_msg: '过滤提示' });
    assert.deepEqual(output.items, [normal, {}]);
    assert.equal(output.tip_msg, undefined);
  });
}
test('开屏预加载清理广告并保留其他配置', () => {
  assert.deepEqual(run('weibo_launch.js', 'https://bootpreload.uve.weibo.com/v1/ad/preload?x=1',
    { ads: [{ id: 1 }], config: 1 }), { ads: [], config: 1, last_ad_show_interval: 86400 });
});
const intlUrl = action => `https://weibointl.api.weibo.cn/portal.php?auth=test&a=${action}`;
test('国际版搜索默认词返回有效结构', () => {
  const output = run('weibo_intl.js', intlUrl('get_searching_info'), {});
  assert.deepEqual(output.data.cards, [{ tip: '搜索微博', word: '' }]);
});
test('国际版热搜保留正常词，过滤置顶与推广', () => {
  const output = run('weibo_intl.js', intlUrl('search_topic'), {
    data: { search_topic: { cards: [{ type: 'normal', word: '正常' }, { type: 'searchtop' }] }, trending_topic: {} }
  });
  assert.deepEqual(output.data, { search_topic: { cards: [{ type: 'normal', word: '正常' }] } });
});
test('国际版 feed 热搜返回空列表和导航结构', () => {
  const output = run('weibo_intl.js', intlUrl('search_topic') + '&feed', {});
  assert.deepEqual(output.data, []);
  assert.equal(output.ext.search_hot.title, '微博热搜榜');
});
test('国际版清理帖子横幅、开屏、VIP 和趋势推广', () => {
  assert.deepEqual(run('weibo_intl.js', intlUrl('open_app'), { data: { close_ad_setting: 1, detail_banner_ad: [1], text: '正常' } }).data,
    { detail_banner_ad: [], text: '正常' });
  assert.deepEqual(run('weibo_intl.js', intlUrl('get_coopen_ads'), { data: { ads: [1] } }).data, { display_ad: 1 });
  assert.deepEqual(run('weibo_intl.js', intlUrl('user_center'), { data: { cards: [{ items: [{ type: 'personal_vip' }] }, { items: [] }] } }).data.cards, [{ items: [] }]);
  assert.deepEqual(run('weibo_intl.js', intlUrl('trends'), { data: { banner: [1], order: ['ad'], search_topic: {} } }).data,
    { order: ['search_topic'], search_topic: {} });
});
test('国际版未知和缺失字段响应保持可用', () => {
  for (const action of ['unknown', 'open_app', 'search_topic', 'user_center']) {
    assert.deepEqual(run('weibo_intl.js', intlUrl(action), { info: '正常' }), { info: '正常' });
  }
});
// 从实际插件中提取规则，验证 URL 会进入预期脚本，避免只验证函数而漏接入口。
test('插件补充入口匹配且不会匹配相邻正常接口', () => {
  const plugin = old ? cp.execFileSync('git', ['show', 'HEAD:Loon/weibo.lpx'], { encoding: 'utf8' })
    : fs.readFileSync(path.join(__dirname, '../../../weibo.lpx'), 'utf8');
  const rules = [...plugin.matchAll(/response if \$\{url\} ~= \/(.+?)\/([a-z]*) then script\("([^"]+)"\)/g)]
    .map(match => ({ re: new RegExp(match[1], match[2]), script: match[3] }));
  const targets = [
    ['https://api.weibo.cn/2/guest/timeline?x=1', 'weibo_main.js'],
    ['https://api.weibo.cn/2/guest/cardlist?x=1', 'weibo_main.js'],
    ['https://api.weibo.cn/2/video/tiny_stream_mid_detail?x=1', 'weibo_main.js'],
    ['https://api.weibo.cn/2/statuses/unread_topic_timeline?x=1', 'weibo_main.js'],
    ['https://bootpreload.uve.weibo.com/v1/ad/preload?x=1', 'weibo_launch.js'],
    [intlUrl('search_topic'), 'weibo_intl.js']
  ];
  for (const [url, script] of targets) {
    assert.ok(rules.some(rule => rule.re.test(url) && rule.script.includes(script)), url);
    if (!url.includes('portal.php')) assert.equal(rules.some(rule => rule.re.test(url.replace('?x=1', '_normal?x=1'))), false);
  }
  assert.equal(rules.some(rule => rule.re.test(intlUrl('user_center_extra'))), false);
  assert.equal(plugin.includes('DOMAIN-SUFFIX, sdkapp.uve.weibo.com, REJECT'), false);
  assert.equal(plugin.includes('DOMAIN, bootpreload.uve.weibo.com, REJECT'), false);
  const requests = [...plugin.matchAll(/request if \$\{url\} ~= \/(.+?)\/([a-z]*) then /g)]
    .map(match => new RegExp(match[1], match[2]));
  for (const endpoint of ['statuses/container_positive', 'account/recommend_interesttags', 'profile/recommend_popuser', 'hot/hours_spotlight']) {
    assert.ok(requests.some(re => re.test(`https://api.weibo.cn/2/${endpoint}?x=1`)), endpoint);
    assert.equal(requests.some(re => re.test(`https://api.weibo.cn/2/${endpoint}_normal?x=1`)), false);
  }
  assert.equal(requests.some(re => re.test('https://api.weibo.cn/2/cardlist?v_f=123&containerid=normal')), false);
  assert.ok(requests.some(re => re.test('https://api.weibo.cn/2/cardlist?v_f=123&from=Weibo_intl')));
  assert.equal(requests.some(re => re.test(intlUrl('get_searching_info'))), false);
  assert.equal(requests.some(re => re.test('https://bootpreload.uve.weibo.com/v1/ad/preload?x=1')), false);
  for (const rule of rules) {
    const filename = rule.script.match(/\/([^/]+\.js)\?/)?.[1];
    assert.ok(filename && fs.existsSync(path.join(__dirname, '..', filename)), rule.script);
  }
});


function runRaw(file, endpoint, body, storedConfig = null) {
  const source = old
    ? cp.execFileSync('git', ['show', `HEAD:Loon/Script/Weibo/${file}`], { encoding: 'utf8' })
    : fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  let output, calls = 0;
  vm.runInNewContext(source, {
    $request: { url: endpoint.startsWith('https://') ? endpoint : `https://api.weibo.cn/2/${endpoint}?test=1` },
    $response: { body }, $loon: {},
    $persistentStore: { read: () => storedConfig, write: () => true },
    $done: result => { calls++; output = result.body; }, console: { log: () => {} }
  }, { timeout: 1000 });
  assert.equal(calls, 1, '异常与成功路径均应只结束一次');
  return output;
}

for (const endpoint of ['guest/container_timeline_hot', 'video/flow_stream']) {
  test(`${endpoint} 合并新旧广告标记并保留正常帖子`, () => {
    const normal = { category: 'feed', data: { id: 1, ad_marked: false, text: '广告讨论' } };
    const output = run('weibo_main.js', endpoint, { items: [normal,
      { category: 'feed', data: { ad_marked: true } },
      { category: 'feed', data: { ad_state: 1 } },
      { category: 'feed', data: { mblogtypename: '广告' } },
      { category: 'feed', data: { promotion: { type: 'ad' } } }
    ] });
    assert.deepEqual(output.items, [normal]);
  });
}
test('新版视频缓存过滤嵌套广告，保留分页和未知列表', () => {
  const normal = { category: 'feed', data: { id: 1 } };
  const output = run('weibo_main.js', 'video/flow_stream_cache', { lists: [
    { items: [normal, { category: 'group', items: [normal, { data: { ad_marked: true } }] }], cursor: 'next' },
    { unknown: 1 }, null
  ] });
  assert.deepEqual(output.lists, [{ items: [normal, { category: 'group', items: [normal] }], cursor: 'next' }, { unknown: 1 }, null]);
});
for (const endpoint of ['search/finder', 'search/container_timeline', 'search/container_discover']) {
  test(`${endpoint} ad_marked 过滤不清空正常发现内容`, () => {
    const normal = { category: 'feed', data: { text: '正常内容', ad_marked: false } };
    const payload = { items: [normal, { data: { ad_marked: true } }] };
    const input = endpoint === 'search/finder' ? { channelInfo: { channels: [{ key: 'discover_channel', payload }] } } : payload;
    const output = run('weibo_ads.js', endpoint, input);
    const actual = endpoint === 'search/finder' ? output.channelInfo.channels[0].payload : output;
    assert.deepEqual(actual.items, [normal]);
  });
}
test('发现页移除问热搜横幅，保留普通热搜和其他图片卡片', () => {
  const askHotSearch = { data: { card_type: 22,
    scheme: 'sinaweibo://messagelist?nick=%E5%BE%AE%E5%8D%9A%E6%99%BA%E6%90%9C&send_from=trending_discover_zhisou&model=newAI' } };
  const other = { data: { card_type: 22,
    scheme: 'sinaweibo://messagelist?extjob_sendfrom=trending_discover_zhisou&send_from=other' } };
  const hotSearch = { data: { card_type: 17, group: [{ itemid: 'normal' }] } };
  const response = { header: { data: { items: [{ items: [askHotSearch, other, hotSearch] }] } } };
  const output = run('weibo_ads.js', 'search/finder', response);
  assert.deepEqual(output.header.data.items[0].items, [other, hotSearch]);
});

for (const [script, endpoint] of [
  ['weibo_main.js', 'statuses/container_timeline'],
  ['weibo_ads.js', 'search/container_timeline']
]) {
  test(`${endpoint} 移除原生推广标签并保留微博和普通话题标签`, () => {
    const normal = { ...feed.data, tag_struct: [{ tag_name: '普通话题', promotion: { monitor_url: [] } }],
      extend_info: { other: '保留' } };
    const sponsored = { ...normal, ad_tag_nature: { otype: 'adFeedDarwinTag', tag_name: '品牌预约' },
      extend_info: { ...normal.extend_info, ad_nature: { ad_nature: 'true' } } };
    const unknown = { ...sponsored, ad_tag_nature: { otype: 'other' } };
    const input = { items: [{ ...feed, data: sponsored }, { ...feed, data: unknown }] };
    const output = run(script, endpoint, input);
    assert.deepEqual(output.items, [{ ...feed, data: normal }, { ...feed, data: unknown }]);
    assert.deepEqual(run(script, endpoint, output), output);
  });
}

test('日配置仅关闭广告开关并保留原始类型和正常配置', () => {
  const output = run('weibo_main.js', 'push/daily', { ug_adv: {
    screen_ad: { effective: true, url: 'normal' }, feed_ad: { effective: '1' },
    feed_ad_arr: [{ effective: 1 }, { effective: 'unknown' }, {}],
    hot_ad: { screen_ad: [{ effective: false }, { effective: '1' }] }, intercept_ad: { switch: 1 }
  }, normal: { enabled: true }, ug_red_packet_lottie_config: { show_max_num: 2 } });
  assert.deepEqual(output, { ug_adv: {
    screen_ad: { effective: false, url: 'normal' }, feed_ad: { effective: '0' },
    feed_ad_arr: [{ effective: 0 }, { effective: 'unknown' }, {}],
    hot_ad: { screen_ad: [{ effective: false }, { effective: '0' }] }, intercept_ad: { switch: 0 }
  }, normal: { enabled: true }, ug_red_packet_lottie_config: { show_max_num: 2 } });
});
test('自动刷新默认开启，显式关闭时保留字段类型', () => {
  for (const value of [true, false, 'true', 'false', 'unknown']) {
    const input = { value: { p_feed_home_auto_refresh_ea1: value, other: true } };
    assert.deepEqual(run('weibo_main.js', 'client/abserver_list', input), { value: { p_feed_home_auto_refresh_ea1: value === 'unknown' ? value : typeof value === 'string' ? 'true' : true, other: true } });
    const output = JSON.parse(runRaw('weibo_main.js', 'client/abserver_list', JSON.stringify(input), JSON.stringify({ homeAutoRefresh: false })));
    assert.equal(output.value.p_feed_home_auto_refresh_ea1, value === 'unknown' ? value : typeof value === 'string' ? 'false' : false);
    assert.equal(output.value.other, true);
  }
});
for (const [file, endpoint] of [
  ['weibo_main.js', 'video/flow_stream'], ['weibo_ads.js', 'search/container_discover'],
  ['weibo_launch.js', 'https://bootpreload.uve.weibo.com/v2/ad/preload?test=1'],
  ['weibo_intl.js', intlUrl('search_topic')]
]) {
  test(`${file} 非 JSON 和非对象响应原样返回且只结束一次`, () => {
    for (const body of ['<html>error</html>', '', 'null', '[]', 'true']) {
      assert.equal(runRaw(file, endpoint, body), body);
    }
  });
}
test('处理器中途异常时不返回半处理响应', () => {
  const main = '{ "items": [{"data":{"ad_marked":true}},null] }';
  assert.equal(runRaw('weibo_main.js', 'statuses/container_timeline', main), main);
  const ads = '{ "pageHeader": {"normal":true}, "items": [null] }';
  assert.equal(runRaw('weibo_ads.js', 'flowpage', ads), ads);
});
test('损坏的本地配置不会阻断广告过滤', () => {
  const body = JSON.stringify({ items: [{ data: { id: 1 } }, { data: { ad_marked: true } }] });
  const output = JSON.parse(runRaw('weibo_main.js', 'video/flow_stream', body, '{broken'));
  assert.deepEqual(output.items, [{ data: { id: 1 } }]);
});
test('没有修改的响应保留原始空白和格式', () => {
  const body = '{ "items": [], "normal": 1 }';
  assert.equal(runRaw('weibo_main.js', 'video/flow_stream', body), body);
  assert.equal(runRaw('weibo_ads.js', 'search/container_discover', body), body);
});
test('增强版规则入口可达，且保留正常 API', () => {
  const plugin = old ? cp.execFileSync('git', ['show', 'HEAD:Loon/weibo.lpx'], { encoding: 'utf8' })
    : fs.readFileSync(path.join(__dirname, '../../../weibo.lpx'), 'utf8');
  const rules = [...plugin.matchAll(/(?:request|response) if \$\{url\} ~= \/(.+?)\/([a-z]*) then (.+)/g)]
    .map(match => ({ re: new RegExp(match[1], match[2]), action: match[3] }));
  for (const endpoint of ['guest/container_timeline_hot', 'video/flow_stream', 'video/flow_stream_cache', 'client/abserver_list', 'push/daily']) {
    const url = `https://api.weibo.cn/2/${endpoint}?test=1`;
    assert.ok(rules.some(rule => rule.re.test(url) && rule.action.includes('weibo_main.js')), endpoint);
    assert.equal(rules.some(rule => rule.re.test(url) && rule.action.includes('reject')), false, endpoint);
    assert.equal(rules.some(rule => rule.re.test(url.replace('?test=1', '_extra?test=1'))), false, endpoint);
  }
  assert.equal(plugin.includes('DOMAIN-SUFFIX, wbapp.uve.weibo.com, REJECT'), false);
});


test('首页头像提示只清理已识别的头像结构', () => {
  const input = { bubble_type: 0, scene: 0, group_type: 1, text: '提示', extparams: '', image: 'https://tvax1.sinaimg.cn/avatar.jpg' };
  assert.deepEqual(run('weibo_main.js', 'remind/hometab_dot', input), { ...input, image: '' });
  for (const patch of [{ scene: 1 }, { group_type: 2 }, { text: 1 }, { image: 'https://example.com/normal.png' }, { image: 'https://tvax1.sinaimg.cn.example.com/avatar.jpg' }]) {
    const normal = { ...input, ...patch };
    assert.deepEqual(run('weibo_main.js', 'remind/hometab_dot', normal), normal);
  }
  assert.deepEqual(JSON.parse(runRaw('weibo_main.js', 'remind/hometab_dot', JSON.stringify(input), JSON.stringify({ hideHomeTabAvatar: false }))), input);
});
test('首页红点和消息汇总数字归零，保留私信及其他计数', () => {
  const input = { timeStamp: 123, remind_settings: {}, status_home: 3, status_hot_home: 2, folder_total_unread: 9, dm: 4, mention_status: 5 };
  assert.deepEqual(run('weibo_main.js', 'remind/unread_count', input), { ...input, status_home: 0, status_hot_home: 0, folder_total_unread: 0 });
  assert.deepEqual(JSON.parse(runRaw('weibo_main.js', 'remind/unread_count', JSON.stringify(input), JSON.stringify({ hideHomeTabRedDot: false, hideMessageTabNumber: false }))), input);
});
test('未识别的提醒结构及字段类型不改写', () => {
  for (const input of [
    { status_home: 1, folder_total_unread: 2 },
    { timeStamp: '123', remind_settings: {}, status_home: 1, folder_total_unread: 2 },
    { timeStamp: 123, remind_settings: [], status_home: 1, folder_total_unread: 2 },
    { timeStamp: 123, remind_settings: {}, status_home: -1, status_hot_home: '2', folder_total_unread: 1.5 }
  ]) assert.deepEqual(run('weibo_main.js', 'remind/unread_count', input), input);
});
function interfacePost() {
  return { id: 1, text: 'AI 内容讨论', bottom_bar_dyna: { cell_item: { ai_search: { title: 'AI' }, comment: { count: 5 } } },
    page_info: { media_info: { duration: 10, play_completion_actions: [{ type: 'next' }] } } };
}
function cleanedPost() {
  const post = interfacePost();
  delete post.bottom_bar_dyna.cell_item.ai_search;
  post.page_info.media_info.play_completion_actions = [];
  return post;
}
for (const [file, endpoint, wrap, unwrap] of [
  ['weibo_main.js', 'statuses/container_timeline', post => ({ items: [{ category: 'feed', data: post }] }), result => result.items[0].data],
  ['weibo_main.js', 'video/flow_stream_cache', post => ({ lists: [{ items: [{ data: post }] }] }), result => result.lists[0].items[0].data],
  ['weibo_ads.js', 'statuses/container_detail', post => ({ detailInfo: { status: post } }), result => result.detailInfo.status],
  ['weibo_ads.js', 'search/finder', post => ({ channelInfo: { channels: [{ key: 'discover_channel', payload: { items: [{ category: 'feed', data: post }] } }] } }), result => result.channelInfo.channels[0].payload.items[0].data]
]) {
  test(`${endpoint} 隐藏帖子 AI 入口和视频结束动作，保留正文及评论按钮`, () => {
    assert.deepEqual(unwrap(run(file, endpoint, wrap(interfacePost()))), cleanedPost());
    const output = JSON.parse(runRaw(file, endpoint, JSON.stringify(wrap(interfacePost())), JSON.stringify({ hideFeedAiButton: false, hidePlaybackCompletionActions: false })));
    assert.deepEqual(unwrap(output), interfacePost());
  });
}
test('未知 AI 和播放完成字段类型保持原样', () => {
  const post = { bottom_bar_dyna: { cell_item: { ai_search: 'unknown' } }, page_info: { media_info: { play_completion_actions: { type: 'unknown' } } } };
  const input = { items: [{ data: post }] };
  assert.deepEqual(run('weibo_main.js', 'video/flow_stream', input), input);
});
test('旧的部分配置继承新默认值，显式 null 保持原样', () => {
  const input = { value: { p_feed_home_auto_refresh_ea1: 'false' } };
  assert.equal(JSON.parse(runRaw('weibo_main.js', 'client/abserver_list', JSON.stringify(input), JSON.stringify({ isDebug: false }))).value.p_feed_home_auto_refresh_ea1, 'true');
  assert.deepEqual(JSON.parse(runRaw('weibo_main.js', 'client/abserver_list', JSON.stringify(input), JSON.stringify({ homeAutoRefresh: null }))), input);
});
test('界面净化路由有对应响应脚本且不会拦截相邻 API', () => {
  const plugin = fs.readFileSync(path.join(__dirname, '../../../weibo.lpx'), 'utf8');
  const rules = [...plugin.matchAll(/(?:request|response) if \$\{url\} ~= \/(.+?)\/([a-z]*) then (.+)/g)]
    .map(match => ({ re: new RegExp(match[1], match[2]), action: match[3] }));
  for (const endpoint of ['remind/hometab_dot', 'remind/unread_count']) {
    const url = `https://api.weibo.cn/2/${endpoint}?test=1`;
    assert.ok(rules.some(rule => rule.re.test(url) && rule.action.includes('weibo_main.js')));
    assert.equal(rules.some(rule => rule.re.test(url) && rule.action.includes('reject')), false);
    assert.equal(rules.some(rule => rule.re.test(url.replace('?test=1', '_other?test=1'))), false);
  }
});

process.exitCode = failures ? 1 : 0;
