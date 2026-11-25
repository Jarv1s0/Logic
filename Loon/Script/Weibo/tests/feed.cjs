// 当前插件完整响应链的合成回归；不访问网络。
// node Loon/Script/Weibo/tests/feed.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'weibo_feed.js'), 'utf8');
const plugin = fs.readFileSync(path.join(root, '../../weibo.lpx'), 'utf8');
const scripts = [...plugin.matchAll(/response if \$\{url\} ~= \/(.+?)\/([a-z]*) then script\("([^"]+)"\)/g)]
  .map(m => ({ re: new RegExp(m[1], m[2]), file: path.basename(new URL(m[3]).pathname) }));
const requests = [...plugin.matchAll(/request if \$\{url\} ~= \/(.+?)\/([a-z]*) then /g)]
  .map(m => new RegExp(m[1], m[2]));
const urlRules = [...plugin.matchAll(/^URL-REGEX,\s*(.+?),\s*REJECT.*$/gm)].map(m => new RegExp(m[1]));
const endpoints = [
  'statuses/container_timeline_hot', 'statuses/container_positive', 'guest/container_timeline_hot',
  'statuses/container_timeline_unread', 'statuses/container_timeline', 'live/media_homelist',
  'remind/hometab_dot', 'remind/unread_count', 'messageflow/notice', 'statuses/container_detail',
  'statuses/container_detail_comment', 'statuses/container_detail_forward', 'comments/build_comments',
  'search/finder', 'search/container_timeline', 'search/container_discover', '!/was/finder/searchbarchange',
  'cardlist', 'flowpage', 'searchall', 'profile/me', 'profile/container_timeline',
  'video/flow_stream', 'video/flow_stream_cache', 'push/daily', 'push/active', 'push/info',
  'guest/push_active', 'groups/allgroups/v2', 'client/get_grayfeature', 'client/abserver_list', 'checkin/show',
  'video/remind_info', 'video/home_channels'
];
const routes = [...endpoints.map(endpoint => ({ host: 'api.weibo.cn', path: '/2/' + endpoint })),
  { host: 'm.weibo.cn', path: '/c/mecard/cardv3' },
  { host: 'bootpreload.uve.weibo.com', path: '/v2/ad/preload' },
  { host: 'bootrealtime.uve.weibo.com', path: '/v3/ad/realtime' },
  { host: 'wbapp.uve.weibo.com', path: '/wbapplua/wbpullad.lua' }];
assert.equal(/^\[(?:Rule|Rewrite)\]$/m.test(plugin), false, '不能保留旧域名拒绝、请求拒绝或 jq 改写区块');
assert.equal(requests.length, 0, '业务请求必须正常返回，不提前拒绝');
assert.equal(scripts.every(rule => ['weibo_feed.js', 'weibo_skin.js', 'weibo_vip.js', 'weibo_intl.js'].includes(rule.file)), true,
  '业务接口不能再调用旧 main、ads 或 launch 处理器');
function routed(url) {
  const matches = scripts.filter(rule => rule.re.test(url));
  assert.equal(matches.length, 1, '每个目标请求只能命中一个响应脚本');
  assert.equal(matches[0].file, 'weibo_feed.js', '目标请求必须进入本地处理器');
  assert.equal([...requests, ...urlRules].some(re => re.test(url)), false, '目标请求不能先被旧拒绝规则截断');
}
for (const endpoint of endpoints) {
  for (const host of ['api.weibo.cn', 'mapi.weibo.cn', 'api.weibo.com', 'mapi.weibo.com']) {
    const url = `https://${host}/2/${endpoint}?networktype=5g`;
    for (const suffix of ['', '?networktype=5g', '#response']) {
      routed(`https://${host}/2/${endpoint}${suffix}`);
    }
    assert.equal(scripts.some(rule => rule.file === 'weibo_feed.js' && rule.re.test(url.replace('?', '_normal?'))), false);
  }
}
for (const route of routes.filter(route => route.host !== 'api.weibo.cn')) {
  routed(`https://${route.host}${route.path}?test=1`);
  assert.equal(scripts.some(rule => rule.file === 'weibo_feed.js'
    && rule.re.test(`https://${route.host}${route.path}_normal?test=1`)), false);
}
for (const endpoint of ['client/interrupt', '!/client/light_skin',
  'statuses/container_timeline_topic', 'statuses/container_timeline_topicpage']) {
  assert.equal(scripts.some(rule => rule.file === 'weibo_feed.js' && rule.re.test(`https://api.weibo.cn/2/${endpoint}?x=1`)), false);
}
assert.equal(scripts.some(rule => rule.re.test('https://api.weibo.cn/2/client/interrupt?test=1')), false,
  '启动配置必须透传，不硬改默认频道');
console.log('通过：全部业务及开屏入口单次命中；没有请求拒绝、jq 或旧处理器重叠');

function run(code, url, body, stored = {}) {
  let calls = 0, networkCalls = 0, output;
  const writes = [];
  function unexpectedNetwork() { networkCalls++; throw Error('响应重放不能访问网络'); }
  const context = {
    $request: { url, method: 'POST', headers: {} },
    $response: { body, status: 200, headers: {} }, $loon: {},
    $persistentStore: {
      read: key => stored[key] ?? null,
      write: (value, key) => { writes.push(key); return true; }
    },
    $done: value => { calls++; output = value?.body ?? body; },
    $httpClient: { get: unexpectedNetwork, post: unexpectedNetwork },
    console: { log() {} }
  };
  vm.runInNewContext(code, context, { timeout: 5000 });
  assert.equal(calls, 1, '脚本必须且只能结束一次');
  assert.equal(networkCalls, 0, '响应处理不能发起额外请求，包括被捕获的失败请求');
  return { body: output, writes };
}

// 与真实个人页相同的入口注入条件：必须含完整 profileme_mine 分组。
const ordinarySettings = { category: 'cell', itemId: 'account_settings', title: { content: '设置' } };
const profileMine = { itemId: 'profileme_mine', category: 'group', type: 'grid',
  header: { category: 'mine', type: 'header', itemId: 'profileme_mine_head' },
  items: [{ itemId: 'album', title: '我的相册' }, ordinarySettings] };
const pluginSettings = { category: 'cell', type: 'title', itemId: 'weibo_local_settings_v3',
  title: { content: '墨鱼微博助手' }, click: { scheme: 'https://api.weibo.cn/__qx_weibo_settings__/' } };
for (const endpoint of ['profile/me', 'profile/container_timeline']) {
  for (const host of ['api.weibo.cn', 'mapi.weibo.com']) {
    const url = `https://${host}/2/${endpoint}`;
    const clean = { items: [profileMine, ordinarySettings], cursor: 'next' };
    assert.deepEqual(JSON.parse(run(source, url, JSON.stringify(clean)).body), clean,
      '完整个人页不得新增插件设置入口，普通设置和分页必须保留');
    const withPlugin = structuredClone(clean);
    withPlugin.items.push(pluginSettings);
    withPlugin.items[0].items.push(pluginSettings);
    assert.deepEqual(JSON.parse(run(source, url, JSON.stringify(withPlugin)).body), clean,
      '顶层和嵌套的历史插件设置入口都必须移除');
  }
}
console.log('通过：完整个人页不注入插件设置，移除历史入口并保留普通设置、相册和分页');

const normals = [{ category: 'feed', data: { idstr: 'normal', text: '普通微博' } },
  { category: 'feed', data: { idstr: 'reposted', text: '转发微博', retweeted_status: { ad_state: 1, text: '被转发正文' } } }];
const ad = { category: 'feed', data: { idstr: 'ad', text: '广告', ad_state: 1, is_ad: 1,
  mblogtypename: '广告', promotion: { type: 'ad' } } };
const fixture = JSON.stringify({ items: [normals[0], ad, normals[1]], moreInfo: { next: 'page2' } });
for (const network of ['wifi', '5g']) {
  for (const host of ['api.weibo.cn', 'mapi.weibo.cn', 'api.weibo.com', 'mapi.weibo.com']) {
    const r = run(source, `https://${host}/2/statuses/container_timeline?networktype=${network}`, fixture,
      { weibo_adblock_config_v3: JSON.stringify({ enabled: false }) });
    assert.deepEqual(JSON.parse(r.body), { items: normals, moreInfo: { next: 'page2' } });
    assert.deepEqual(r.writes, [], '不能更改其他插件的设置');
  }
}
for (const route of routes) {
  for (const body of ['', '<html>error</html>', 'null', '[]', 'true']) {
    const result = run(source, `https://${route.host}${route.path}?x=1`, body);
    assert.equal(result.body, body, '所有入口的异常正文必须透传：' + route.path);
    assert.deepEqual(result.writes, [], '异常正文不能更改持久配置');
  }
}
console.log('通过：两种网络、四个域名均过滤广告并保留普通微博、转发正文和分页，异常正文安全透传');

for (const endpoint of ['statuses/container_timeline', 'statuses/container_timeline_hot',
  'statuses/container_timeline_unread', 'statuses/container_positive', 'guest/container_timeline_hot']) {
  const stateOnly = { category: 'feed', data: { idstr: 'state-only', ad_state: 1, text: '缺少明确广告标志' } };
  const body = JSON.stringify({ items: [normals[0], stateOnly, ad] });
  const result = run(source, `https://api.weibo.cn/2/${endpoint}`, body, { mainConfig: '{broken' });
  assert.deepEqual(JSON.parse(result.body).items, [normals[0], stateOnly], '首页单独的 ad_state 不能作为删帖依据');
}
console.log('通过：五类首页信息流保留正常帖子，保留只有 ad_state 的帖子，损坏配置不影响过滤');

const fanHeadlineAds = [
  { category: 'feed', data: { mblogtypename: '粉丝头条' } },
  { category: 'feed', data: { content_auth_info: { content_auth_title: '粉丝头条' } } },
  { category: 'feed', data: { tag_struct: [{ tag_name: '粉丝头条' }] } },
  { category: 'feed', data: { tag_struct: [{ otype: 'fans_headline' }] } }
];
const fanHeadlineNormal = { category: 'feed', data: { text: '这条正文提到了粉丝头条' } };
for (const endpoint of ['statuses/container_timeline', 'statuses/container_timeline_hot',
  'statuses/container_timeline_unread', 'statuses/container_positive', 'guest/container_timeline_hot']) {
  const input = { items: [fanHeadlineNormal, ...fanHeadlineAds], moreInfo: { next: 'page2' } };
  assert.deepEqual(JSON.parse(run(source, `https://api.weibo.cn/2/${endpoint}`, JSON.stringify(input)).body),
    { items: [fanHeadlineNormal], moreInfo: input.moreInfo }, '粉丝头条整条过滤，正文提及需保留');
}
console.log('通过：五类动态入口过滤粉丝头条标记，保留正文仅提及该词的微博');

const sizes = ['largest', 'thumbnail', 'large', 'middleplus', 'mw2000', 'bmiddle'];
const picture = { original: { url: 'https://wx1.sinaimg.cn/orh1080/picture.jpg' },
  ...Object.fromEntries(sizes.map(size => [size, { url: `https://wx1.sinaimg.cn/${size}/picture.jpg`, width: 100 }])) };
const legacy = { items: [
  { status: { idstr: 'legacy', ad_state: 1, pic_infos: { one: picture },
    common_struct: { ad: true }, semantic_brand_params: { ad: true },
    extend_info: { shopwindow_cards: [], ad_semantic_brand: {}, keep: true } } },
  { category: 'feed', status: { idstr: 'legacy-ad', ad_marked: true, mblogtypename: '广告' } },
  { data: { idstr: 'uncategorized', common_struct: { ad: true }, semantic_brand_params: { ad: true },
    retweeted_status: { idstr: 'quoted', ad_marked: true, text: '原文保留' },
    pic_infos: { unknown: { original: { url: 123 }, thumbnail: { url: 'keep' } } } } }
] };
const legacyOutput = JSON.parse(run(source, 'https://api.weibo.cn/2/statuses/container_timeline', JSON.stringify(legacy)).body);
const expectedLegacy = structuredClone(legacy);
expectedLegacy.items.splice(1, 1);
delete expectedLegacy.items[0].status.common_struct;
delete expectedLegacy.items[0].status.semantic_brand_params;
expectedLegacy.items[0].status.extend_info = { keep: true };
for (const size of sizes) expectedLegacy.items[0].status.pic_infos.one[size].url = 'https://wx1.sinaimg.cn/oslarge/picture.jpg';
delete expectedLegacy.items[1].data.common_struct;
delete expectedLegacy.items[1].data.semantic_brand_params;
assert.deepEqual(legacyOutput, expectedLegacy);
console.log('通过：旧 status 格式与无 category 帖子继续清理推广并保留图片转换、未知尺寸和转发正文');

const protectedBody = JSON.stringify({ items: [{ category: 'feed', data: {
  idstr: 'normal-profile-post', ad_state: 1, text: '正常个人页微博', pic_infos: { one: picture }
} }] });
for (const shadowPath of ['/2/search/finder', '/2/statuses/container_timeline']) {
  const url = `https://api.weibo.cn/2/profile/me?from=${shadowPath}`;
  assert.deepEqual(JSON.parse(run(source, url, protectedBody).body),
    JSON.parse(protectedBody), '查询参数里的路径不能改变实际响应的处理范围');
}
console.log('通过：只按实际路径限定本地清理，查询参数中的首页或发现路径不影响个人页');

const groups = { defaultPageId: 'recommend', pageDatas: [{ pageId: 'homeFeed', categories: [{ pageDatas: [
  { title: '全部关注', gid: 'all', uid: 'demo' }, { title: '最新微博', gid: 'latest', uid: 'demo' },
  { title: '超话社区', gid: '110057182642782' }
] }] }] };
const groupsUrl = 'https://api.weibo.cn/2/groups/allgroups/v2';
const actualGroups = JSON.parse(run(source, groupsUrl, JSON.stringify(groups)).body);
assert.equal(actualGroups.defaultPageId, 'homeFeed');
assert.deepEqual(actualGroups.pageDatas[0].categories[0].pageDatas.map(group => group.title), ['最新微博', '全部关注', '超话社区']);
const titles = actualGroups.pageDatas.flatMap(page => (page.categories ?? []).flatMap(category => category.pageDatas ?? []))
  .map(group => group.title);
assert.ok(titles.includes('全部关注') && titles.includes('超话社区'), '不能硬删普通关注分组和超话入口');
const bootUrl = 'https://bootrealtime.uve.weibo.com/v3/ad/realtime';
const boot = { ads: [], normal: { keep: true } };
assert.deepEqual(JSON.parse(run(source, bootUrl, JSON.stringify(boot)).body),
  boot);
assert.deepEqual(JSON.parse(run(source, bootUrl, JSON.stringify(boot)).body).normal, boot.normal,
  '实时开屏必须处理真实响应并保留正常配置，不能返回空对象');
console.log('通过：分组与实时开屏由本地处理，保留普通标签及正常配置');

const hotSearch = { category: 'card', data: { card_type: 17, group: [{ word: '正常热搜', itemid: 'normal' }],
  group_unfold: [{ word: '正常热搜', itemid: 'normal' }] } };
const ask = { category: 'card', data: { card_type: 22,
  scheme: 'sinaweibo://messagelist?send_from=trending_discover_zhisou&x=1' } };
const ordinaryImage = { category: 'card', data: { card_type: 22, scheme: 'sinaweibo://normal' } };
const discovery = { channelInfo: { channels: [{ key: 'discover_channel', pageId: 'discover',
  payload: { items: [...normals, ad, ask, ordinaryImage], moreInfo: { next: 'p2' } } },
  { key: 'future_channel', pageId: 'future' }] }, header: { data: { items: [hotSearch] } } };
const discoveryUrl = 'https://api.weibo.cn/2/search/finder?networktype=5g';
const output = JSON.parse(run(source, discoveryUrl, JSON.stringify(discovery)).body);
assert.deepEqual(output.channelInfo.channels.map(c => c.key), ['discover_channel', 'future_channel']);
const kept = output.channelInfo.channels[0].payload;
assert.deepEqual(kept.items, [...normals, ordinaryImage]);
assert.deepEqual(kept.moreInfo, { next: 'p2' });
assert.deepEqual(output.header.data.items, [hotSearch]);
console.log('通过：发现页保留现有及未知频道、正常热搜与普通图片卡片，移除广告和问热搜入口');

const normalSearchCard = { card_type: 9, mblog: { id: 1, text: '普通搜索结果',
  retweeted_status: { id: 10, is_ad: 1, text: '转发引用不能删除' } } };
for (const endpoint of ['cardlist', 'searchall', 'search/container_timeline']) {
  const input = { cards: [{ card_type: 11, card_group: [normalSearchCard,
    { card_type: 9, mblog: { id: 2, is_ad: 1, mblogtypename: '广告' } }, { card_type: 118 }] }],
    moreInfo: { next: 'p3' } };
  const expected = { cards: [{ card_type: 11, card_group: [normalSearchCard] }], moreInfo: input.moreInfo };
  assert.deepEqual(JSON.parse(run(source, `https://api.weibo.cn/2/${endpoint}`, JSON.stringify(input)).body), expected,
    'card_group 中也要过滤广告，保留普通搜索结果和转发引用');
}

for (const endpoint of ['push/daily', 'push/active', 'push/info', 'guest/push_active']) {
  const input = { ug_adv: { screen_ad: { effective: true }, feed_ad: { effective: '1' },
    feed_ad_arr: [{ effective: 1 }, { effective: 'unknown' }],
    hot_ad: { screen_ad: [{ effective: true }] }, intercept_ad: { switch: 1 } },
    ug_red_packet_lottie_config: { show_max_num: 2 }, normal: { enabled: true } };
  const expected = structuredClone(input);
  expected.ug_adv.screen_ad.effective = false;
  expected.ug_adv.feed_ad.effective = '0';
  expected.ug_adv.feed_ad_arr[0].effective = 0;
  expected.ug_adv.hot_ad.screen_ad[0].effective = false;
  expected.ug_adv.intercept_ad.switch = 0;
  assert.deepEqual(JSON.parse(run(source, `https://api.weibo.cn/2/${endpoint}`, JSON.stringify(input)).body), expected);
}
for (const route of routes.filter(route => route.host.endsWith('.uve.weibo.com'))) {
  const input = { ads: [{ id: 'ad' }], cached_ad: { ads: [{ id: 'cached' }], keep: true }, normal: { keep: true } };
  const expected = { ...input, ads: [], cached_ad: { ads: [], keep: true } };
  if (route.path.endsWith('/preload')) expected.last_ad_show_interval = 86400;
  assert.deepEqual(JSON.parse(run(source, `https://${route.host}${route.path}`, JSON.stringify(input)).body), expected);
}
for (const endpoint of ['cardlist', 'flowpage', 'searchall', '!/was/finder/searchbarchange',
  'statuses/container_detail', 'statuses/container_detail_comment', 'statuses/container_detail_forward',
  'comments/build_comments', 'profile/me', 'profile/container_timeline', 'video/flow_stream', 'video/flow_stream_cache']) {
  const input = { items: [normals[0], ad, normals[1]], moreInfo: { next: 'p2' } };
  assert.deepEqual(JSON.parse(run(source, `https://api.weibo.cn/2/${endpoint}`, JSON.stringify(input)).body),
    { items: normals, moreInfo: input.moreInfo }, '当前处理器必须实际过滤广告：' + endpoint);
}
const liveInput = { code: 100000, data: [{ id: 'live' }], normal: true };
assert.deepEqual(JSON.parse(run(source, 'https://api.weibo.cn/2/live/media_homelist', JSON.stringify(liveInput)).body),
  { ...liveInput, data: [] });
const unknownLive = { code: 'unknown', data: [{ id: 'normal' }] };
assert.deepEqual(JSON.parse(run(source, 'https://api.weibo.cn/2/live/media_homelist', JSON.stringify(unknownLive)).body), unknownLive);
for (const [value, expected] of [[true, false], [1, 0], ['1', '0'], ['unknown', 'unknown']]) {
  assert.deepEqual(JSON.parse(run(source, 'https://api.weibo.cn/2/checkin/show', JSON.stringify({ show: value, normal: 1 })).body),
    { show: expected, normal: 1 });
}
const reminder = { exist_remind: true, bubble_dismiss_time: 10, image_dismiss_time: 20, image: 'ad.png', other: 1 };
assert.deepEqual(JSON.parse(run(source, 'https://api.weibo.cn/2/video/remind_info', JSON.stringify(reminder)).body),
  { exist_remind: false, bubble_dismiss_time: 0, image_dismiss_time: 0, image: '', other: 1 });
const channels = { channel_list: [{ title: '推荐' }, { title: '未知频道' }], normal: 1 };
assert.deepEqual(JSON.parse(run(source, 'https://api.weibo.cn/2/video/home_channels', JSON.stringify(channels)).body), channels);
console.log('通过：当前搜索、详情、个人页、视频处理器过滤广告；开屏与配置只改已识别字段，未知结构保留');

const vehicleTag = { otype: 'adFeedDarwinTag', tag_name: '预约试驾' };
const placeTag = { otype: 'place', tag_name: '地点' };
const taggedPost = { text: '正文', tag_struct: [vehicleTag, placeTag],
  retweeted_status: { text: '转发原文', tag_struct: [vehicleTag, placeTag] } };
const cleanPost = { ...taggedPost, tag_struct: [placeTag],
  retweeted_status: { ...taggedPost.retweeted_status, tag_struct: [placeTag] } };
const process = (endpoint, input) =>
  JSON.parse(run(source, 'https://api.weibo.cn/2/' + endpoint, JSON.stringify(input)).body);
assert.deepEqual(process('statuses/container_timeline', { items: [{ category: 'feed', data: taggedPost }] }),
  { items: [{ category: 'feed', data: cleanPost }] });

const detailStatus = { category: 'detail', type: 'status' };
const shopAd = { category: 'card', data: { card_type: 3, actionlog: { cardid: 'wbg_goodsadvise' } } };
const normalCard = { category: 'card', data: { card_type: 3 } };
const shopGroup = { category: 'group', type: 'vertical', items: [shopAd] };
const mixedGroup = { ...shopGroup, items: [normalCard, shopAd] };
const detailRecommendationAd = { category: 'group', type: 'vertical', header: { title: '相关推荐' }, items: [
  { category: 'card', data: { card_type: 143, height: 1 } },
  { category: 'card', data: { card_type: 22, card_ad_style: 1, is_detail: true,
    scheme: 'alipays://platformapi/startapp?source=weibo_new' } }
] };
const followRecommendationGroup = { category: 'group', type: 'vertical', items: [
  { category: 'card', data: { card_type: 4, desc: '关注推荐', is_detail: true } },
  { category: 'card', data: { card_type: 86, is_detail: true } }
] };
const genericRecommendationCard = { category: 'card', data: { card_type: 227, desc: '热门推荐' } };
const normalDetailGroup = { category: 'group', type: 'vertical', items: [
  { category: 'card', data: { card_type: 22, is_detail: true } }
] };
const detail = {
  pageHeader: { data: { items: [detailStatus,
    { category: 'card', data: { card_type: 248, itemid: 'top_searching', is_detail: true } },
    { category: 'detail', type: 'share' }, shopGroup, mixedGroup, detailRecommendationAd,
    followRecommendationGroup, genericRecommendationCard, normalDetailGroup] } },
  detailInfo: { status: taggedPost, extend: { comments_count: 3 } },
  pageTabBar: { items: [{ title: '评论' }] }
};
assert.deepEqual(process('statuses/container_detail', detail), {
  ...detail,
  pageHeader: { data: { items: [detailStatus, { ...mixedGroup, items: [normalCard] }, normalDetailGroup] } },
  detailInfo: { ...detail.detailInfo, status: cleanPost }
});

const profile = { items: [profileMine,
  { category: 'cell', type: 'title', itemId: 'mine_attent_title' },
  { category: 'mine', type: 'mineAttent', itemId: '100505_-_meattent_-_123' },
  ordinarySettings], moreInfo: { next: 'p2' } };
assert.deepEqual(process('profile/me', profile), { ...profile, items: [profileMine, ordinarySettings] });

const notice = { messages: [{ type: 57, msg_card: { ad_tag: { text: '是 TA 的铁粉' } } },
  { type: 47, msg_card: { ad_tag: { text: '广告' } } },
  { type: 47, msg_card: { ad_tag: { text: '荐读' } } },
  { type: 47, msg_card: { ad_tag: { text: '未知' } } }], next_cursor: 'p2' };
assert.deepEqual(process('messageflow/notice', notice), { ...notice, messages: [notice.messages[0], notice.messages[3]] });
console.log('通过：首页与转发车型推广、详情推广模块、动态广告及“我”页推荐均可过滤，普通内容与分页保留');

const meCardsUrl = 'https://m.weibo.cn/c/mecard/cardv3?test=1';
const walletAccount = { category: 'mine', type: 'card2', content: { content: '金融资产' } };
const loanCard = { category: 'mine', type: 'card2', content: { content: '可借额度' } };
const creditCard = { ...loanCard, content: { content: '已临时开通' },
  arrayText: { contents: [{ content: '1000额度' }] } };
const rentalCard = { adData: { promotion: { monitor_url: [{ click_monitor_url: 'https://example.com/ad' }] } } };
const walletCard = { itemId: '100505_-_mypay_new', items: [loanCard, rentalCard, creditCard, walletAccount] };
const recentCard = { itemId: '100505_-_recentlyuser', items: [loanCard] };
const meCards = { ok: 1, data: {
  opened: [{ itemId: '100505_-_aibanliao' }, walletCard],
  closed: [{ itemId: '100505_-_diamond' }, recentCard, { itemId: 'future_service' }],
  metadata: { keep: true }
} };
const rewrittenCards = JSON.parse(run(source, meCardsUrl, JSON.stringify(meCards)).body);
assert.deepEqual(rewrittenCards, { ok: 1, data: {
  ...meCards.data, opened: [{ ...walletCard, items: [walletAccount] }],
  closed: [recentCard, meCards.data.closed[2]]
} });
const otherHost = meCardsUrl.replace('m.weibo.cn', 'api.weibo.cn');
assert.equal(scripts.some(rule => rule.re.test(otherHost)), false);
assert.deepEqual(JSON.parse(run(source, otherHost, JSON.stringify(meCards)).body), meCards);
console.log('通过：更多功能过滤打开和折叠分组里的推广，保留钱包账户、经常访问和未知功能');

for (const [enabled, disabled] of [['true', 'false'], [true, false], ['unknown', 'unknown']]) {
  const key = 'p_sg_left_discovery_positive_a_enable';
  const ab_data = { [key]: enabled, p_feed_detail_dyna_bottom_bar_glass_search_enable: 'true' };
  assert.deepEqual(process('client/get_grayfeature', { ab_data }), { ab_data: { ...ab_data, [key]: disabled } });
}
const postButton = { type: '1', icon: 'https://example.com/post.png', scheme: 'sinaweibo://compose' };
const taskButton = { type: '1', icon: 'https://example.com/hongbao.png',
  scheme: 'https://m.weibo.cn/c/checkin?from=home', icon_reverse: 'reversed' };
const guestButton = { ...taskButton, scheme: 'sinaweibo://login?from=home&ug_guest=1' };
for (const endpoint of ['push/active', 'guest/push_active']) {
  for (const button of [taskButton, guestButton]) {
    const input = { feed_redpacket: button, post_button: postButton };
    assert.deepEqual(process(endpoint, input), {
      ...input, feed_redpacket: { ...button, type: '0', icon: '', icon_reverse: '' }
    });
  }
  const other = { feed_redpacket: { ...postButton, icon: taskButton.icon }, post_button: postButton };
  assert.deepEqual(process(endpoint, other), other);
}
const daily = { feed_redpacket: taskButton };
assert.deepEqual(process('push/daily', daily), daily);
console.log('通过：首页超话与签到红包入口定向关闭，其他实验、发帖及未知入口保留');

const promotionUnread = {
  timeStamp: 123, remind_settings: {}, dm: 3, cmt: 2, mention_status: 1, attitude: 4,
  notice_unread: [{ group_id: 20989, unread_count: 1 }], activity_above_all_remind_count: 1,
  ext: { jieqian: 1, RedPackets: 1, card_background: 1, order_gmv: 1, notification: 1, unknown: 5 },
  ext_new: { jieqian: { count: 1, type: 'all' }, RedPackets: { count: 1 },
    card_background: { count: 1 }, order_gmv: { count: 1 }, notification: { count: 1 }, unknown: { count: 5 } }
};
const expectedUnread = structuredClone(promotionUnread);
for (const key of ['jieqian', 'RedPackets', 'card_background']) {
  expectedUnread.ext[key] = 0;
  expectedUnread.ext_new[key].count = 0;
}
assert.deepEqual(process('remind/unread_count', promotionUnread), expectedUnread);
const malformedPromotion = { ...promotionUnread, ext: { jieqian: '1' }, ext_new: { jieqian: { count: -1 } } };
assert.deepEqual(process('remind/unread_count', malformedPromotion), malformedPromotion);
console.log('通过：新旧推广红点计数同步清理，私信、互动、订单、混合动态及未知计数保留');
