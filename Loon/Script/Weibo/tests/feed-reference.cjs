// 读取本地 HAR；不请求网络，不打印 URL 参数、用户 ID 或正文。
// node Loon/Script/Weibo/tests/feed-reference.cjs [HAR路径] [--baseline]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'weibo_feed.js'), 'utf8');
const upstream = source.split('// BEGIN UPSTREAM 0.1.59\n')[1]?.split('\n// END UPSTREAM 0.1.59')[0];
assert.ok(upstream, '必须保留固定上游来源区块');
assert.equal(crypto.createHash('sha256').update(upstream).digest('hex'),
  '5ed91dbb4e764c1feecd8159a039f21a95499d5bffc55986595ba5e55c8f8657', '上游代码未经修改');
const plugin = process.argv.includes('--baseline')
  ? cp.execFileSync('git', ['show', 'HEAD:Loon/weibo.lpx'], { encoding: 'utf8' })
  : fs.readFileSync(path.join(root, '../../weibo.lpx'), 'utf8');
const scripts = [...plugin.matchAll(/response if \$\{url\} ~= \/(.+?)\/([a-z]*) then script\("([^"]+)"\)/g)]
  .map(m => ({ re: new RegExp(m[1], m[2]), file: path.basename(new URL(m[3]).pathname) }));
const requests = [...plugin.matchAll(/request if \$\{url\} ~= \/(.+?)\/([a-z]*) then /g)]
  .map(m => new RegExp(m[1], m[2]));
const urlRules = [...plugin.matchAll(/^URL-REGEX,\s*(.+?),\s*REJECT.*$/gm)].map(m => new RegExp(m[1]));
const endpoints = ['statuses/container_timeline', 'statuses/container_timeline_hot',
  'statuses/container_timeline_unread', 'statuses/container_positive', 'guest/container_timeline_hot',
  'guest/push_active', 'search/finder', 'search/container_timeline', 'search/container_discover',
  '!/was/finder/searchbarchange', 'push/daily', 'push/active', 'push/info'];
function routed(url) {
  const matches = scripts.filter(rule => rule.re.test(url));
  assert.equal(matches.length, 1, '每个目标请求只能命中一个响应脚本');
  assert.equal(matches[0].file, 'weibo_feed.js', '目标请求必须进入参考兼容入口');
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
for (const endpoint of ['groups/allgroups/v2', 'client/interrupt', '!/client/light_skin',
  'statuses/container_timeline_topic', 'statuses/container_timeline_topicpage']) {
  assert.equal(scripts.some(rule => rule.file === 'weibo_feed.js' && rule.re.test(`https://api.weibo.cn/2/${endpoint}?x=1`)), false);
}
console.log('通过：13 类入口单次命中、相邻接口和原有界面入口不受影响');

function run(code, url, body, stored = {}) {
  let calls = 0, networkCalls = 0, output;
  const writes = [];
  function unexpectedNetwork() { networkCalls++; throw Error('响应重放不能访问网络'); }
  vm.runInNewContext(code, {
    $request: { url, method: 'POST', headers: {} },
    $response: { body, status: 200, headers: {} }, $loon: {},
    $persistentStore: {
      read: key => stored[key] ?? null,
      write: (value, key) => { writes.push(key); return true; }
    },
    $done: value => { calls++; output = value?.body ?? body; },
    $httpClient: { get: unexpectedNetwork, post: unexpectedNetwork },
    console: { log() {} }
  }, { timeout: 5000 });
  assert.equal(calls, 1, '脚本必须且只能结束一次');
  assert.equal(networkCalls, 0, '响应处理不能发起额外请求，包括被捕获的失败请求');
  return { body: output, writes };
}
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
for (const body of ['', '<html>error</html>', 'null', '[]', 'true']) {
  assert.equal(run(source, 'https://api.weibo.cn/2/search/finder?x=1', body).body, body);
}
console.log('通过：两种网络、四个域名均过滤广告并保留普通微博、转发正文和分页，异常正文安全透传');

for (const endpoint of ['statuses/container_timeline', 'statuses/container_timeline_hot',
  'statuses/container_timeline_unread', 'statuses/container_positive', 'guest/container_timeline_hot']) {
  const stateOnly = { category: 'feed', data: { idstr: 'state-only', ad_state: 1, text: '缺少明确广告标志' } };
  const body = JSON.stringify({ items: [normals[0], stateOnly, ad] });
  const result = run(source, `https://api.weibo.cn/2/${endpoint}`, body, { mainConfig: '{broken' });
  assert.deepEqual(JSON.parse(result.body).items, [normals[0], stateOnly], '首页单独的 ad_state 不能作为删帖依据');
}
console.log('通过：五类首页信息流使用参考判定，保留只有 ad_state 的帖子，损坏配置不影响过滤');

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

const harPath = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (harPath) {
  const entries = JSON.parse(fs.readFileSync(harPath, 'utf8').replace(/^\uFEFF/, '')).log.entries;
  const decode = c => c.encoding === 'base64' ? Buffer.from(c.text, 'base64').toString('utf8') : c.text;
  const settings = entries.find(e => new URL(e.request.url).pathname === '/__qx_weibo_settings__/api/config');
  assert.ok(settings, '参考包必须带有实际设置，不能猜测配置');
  const actual = JSON.parse(decode(settings.response.content));
  assert.equal(actual.version, '0.1.59');
  let count = 0;
  for (const entry of entries) {
    const u = new URL(entry.request.url);
    if (!['/2/statuses/container_timeline', '/2/search/finder', '/2/search/container_discover'].includes(u.pathname)) continue;
    routed(entry.request.url);
    assert.ok(entry.response._loonOriginal?.content?.text, '必须有真实原始响应');
    const raw = decode(entry.response._loonOriginal.content);
    const oracle = run(upstream, entry.request.url, raw,
      { weibo_adblock_config_v3: JSON.stringify(actual.config) });
    assert.deepEqual(JSON.parse(oracle.body), JSON.parse(decode(entry.response.content)), '上游必须复现参考插件真实输出');
    const result = run(source, entry.request.url, raw);
    const data = JSON.parse(result.body), original = JSON.parse(raw);
    const wifi = new URL(entry.request.url); wifi.searchParams.set('networktype', 'wifi');
    assert.deepEqual(data, JSON.parse(run(source, wifi.href, raw).body), '相同正文不能因网络标记不同而改变过滤结果');
    if (u.pathname.endsWith('/finder')) {
      assert.deepEqual(data.channelInfo.channels.map(c => c.key), original.channelInfo.channels.map(c => c.key));
      for (const [index, before] of original.channelInfo.channels.entries()) {
        if (!before.payload) continue;
        const after = data.channelInfo.channels[index].payload;
        function normalIds(node, found = []) {
          if (!node || typeof node !== 'object') return found;
          if (node.category === 'feed' && node.data?.mblogtypename !== '广告' && node.data?.is_ad !== 1) found.push(node.data.idstr ?? node.data.id);
          for (const value of Object.values(node)) if (value && typeof value === 'object') normalIds(value, found);
          return found;
        }
        assert.deepEqual(normalIds(after.items), normalIds(before.payload.items), '普通发现微博必须保留');
        assert.equal(JSON.stringify(after.items).includes('"mblogtypename":"广告"'), false);
        assert.deepEqual(after.moreInfo, before.payload.moreInfo);
      }
    }
    if (u.pathname.endsWith('/container_timeline')) {
      const id = item => item.data?.idstr ?? item.data?.id;
      assert.deepEqual(data.items.map(id), JSON.parse(oracle.body).items.map(id), '首页必须与有效参考保留同一批帖子');
      assert.deepEqual(data.moreInfo, original.moreInfo);
      assert.deepEqual(data.refreshInfo, original.refreshInfo);
    }
    count++;
  }
  assert.equal(count, 6, '参考样本必须覆盖四次发现、一次刷新和一次首页');
  console.log('通过：6 份真实响应复现参考输出；兼容入口保留正常内容、分页及网络一致性');
}
