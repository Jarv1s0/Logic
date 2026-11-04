const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../xianyu.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../../../Xianyu_remove_ads.lpx'), 'utf8');
const rule = new RegExp(plugin.match(/^http-response (\S+)/m)[1]);
const url = api => `https://acs.m.goofish.com/gw/${api}/1.0/`;
let checks = 0;
function run(api, data, options = {}) {
  const body = options.raw ?? JSON.stringify({ret: ['SUCCESS::调用成功'], data, trace: 'keep'});
  const results = [];
  vm.runInNewContext(source, {
    $request: {url: options.url ?? url(api)},
    $response: {body, status: options.status ?? 200},
    $done: value => results.push(value),
  });
  assert.equal(results.length, 1);
  checks++;
  return {body, result: JSON.parse(JSON.stringify(results[0]))};
}
function expect(api, data, expected) {
  const {body, result} = run(api, data);
  const output = JSON.parse(result.body ?? body);
  assert.deepEqual(output.data, expected);
  assert.deepEqual(output.ret, ['SUCCESS::调用成功']);
  assert.equal(output.trace, 'keep');
}
const normal = {data: {bizType: 'item'}, id: '商品'};
const unknown = {data: {bizType: 'future'}, id: '未知模块'};
expect('mtop.taobao.idlehome.home.nextfresh',
  {sections: [normal, {data: {bizType: 'AD'}}, unknown, null], cursor: 'next'},
  {sections: [normal, unknown, null], cursor: 'next'});
const buyFeeds = 'mtop.taobao.idle.item.buy.feeds';
const local = 'mtop.taobao.idle.local.home';
expect(local, {sections: [normal, {data: {bizType: 'AD'}}, unknown, null], cursor: 'next'},
  {sections: [normal, unknown, null], cursor: 'next'});
const extra = [
  ['mtop.taobao.idle.user.strategy.list', 'strategies'],
  ['mtop.taobao.idlemtopsearch.search.shade', 'singleShadeWords'],
  ['mtop.taobao.idlemtopsearch.item.search.activate', 'cardList'],
  ['mtop.taobao.idlemtopsearch.search.discover', 'resultList'],
];
for (const [api, key] of extra) {
  const remove = key === 'resultList';
  expect(api, {[key]: [{id: '推广'}], keep: 1}, remove ? {keep: 1} : {[key]: [], keep: 1});
  assert.deepEqual(run(api, {[key]: {future: true}}).result, {});
  assert.deepEqual(run(api, {}, {raw: JSON.stringify({ret: ['FAIL::错误'], data: {[key]: [normal]}})}).result, {});
}
const circle = 'mtop.taobao.idlehome.home.circle.list';
expect(circle, {circleList: [{bizCode: 'main'}, {bizCode: 'saveMoney'}, unknown, null], keep: 1},
  {circleList: [{bizCode: 'main'}, unknown, null], keep: 1});
expect(buyFeeds, {sections: [normal, {data: {bizType: 'AD'}}, unknown], cursor: 'next'}, {cursor: 'next'});
expect(buyFeeds, {sections: [normal], cursor: 'next'}, {cursor: 'next'});
for (const data of [{sections: 'unknown'}, {unexpected: true}]) assert.deepEqual(run(buyFeeds, data).result, {});
assert.deepEqual(run(buyFeeds, {}, {raw: JSON.stringify({ret: ['FAIL::错误'], data: {sections: [normal]}})}).result, {});
const search = 'mtop.taobao.idlemtopsearch.search';
const marked = flag => ({data: {item: {main: {exContent: {isAliMaMaAD: flag}}}}});
expect(search, {resultList: [marked(true), marked('true'), marked(false), marked('false'), unknown, null], total: 6},
  {resultList: [marked(false), marked('false'), unknown, null], total: 6});
expect(search, {resultList: [{data: {item: {main: {clickParam: {args: {biz_type: 'mamaAD'}}}}}}, normal]}, {resultList: [normal]});
for (const api of ['mtop.taobao.idle.item.recommend', 'mtop.taobao.idle.item.recommend.list']) {
  expect(api, {cardList: [{cardData: {bizType: 'mamaAD'}}, normal, unknown, null]}, {cardList: [normal, unknown, null]});
}
const mine = 'mtop.idle.user.page.my.adapter';
const sections = ['0', '1', '2', '3', '4', '5'].map(index => ({index, label: `模块${index}`}));
expect(mine, {container: {sections, other: 1}, ability: [{recommend: true}], account: 'keep'},
  {container: {sections, other: 1}, ability: [], account: 'keep'});
expect(mine, {container: {sections: [normal, {data: {bizType: 'AD'}}, unknown]}},
  {container: {sections: [normal, unknown]}});
expect(mine, {container: {sections: [{index: '2'}, {index: 'new'}]}, ability: {unknown: true}},
  {container: {sections: [{index: '2'}, {index: 'new'}]}, ability: {unknown: true}});
for (const data of [{sections: []}, {sections: 'unknown'}, {sections: [normal, unknown, null]}, {unexpected: true}]) {
  assert.deepEqual(run('mtop.taobao.idlehome.home.nextfresh', data).result, {});
}
for (const raw of ['bad json', '<html>error</html>', 'null', '[]',
  JSON.stringify({data: {resultList: [marked(true)]}}),
  JSON.stringify({ret: ['FAIL_SYS_SESSION_EXPIRED::登录失效'], data: {resultList: [marked(true)]}})]) {
  assert.deepEqual(run(search, null, {raw}).result, {});
}
assert.deepEqual(run(search, {resultList: [marked(true)]}, {status: 500}).result, {});
assert.deepEqual(run(search, {resultList: [marked(true)]}, {url: url(search + '.extra')}).result, {});
const apis = ['mtop.taobao.idlehome.home.nextfresh', search, 'mtop.taobao.idle.item.recommend',
  'mtop.taobao.idle.item.recommend.list', buyFeeds, mine, local, circle, ...extra.map(([api]) => api)];
const hosts = plugin.match(/^hostname = (.+)$/m)[1].split(', ');
for (const api of apis) {
  for (const host of ['acs.m.goofish.com', 'g-acs.m.goofish.com']) {
    assert(rule.test(`https://${host}/gw/${api}/1.0/?x=1`));
    assert(hosts.includes(host));
  }
  assert(!rule.test(url(api + '.extra')));
  assert(!rule.test(url(api) + 'extra'));
}
for (const api of ['mtop.taobao.idlemtopsearch.search.delete', 'mtop.idle.message.chat', 'mtop.idle.trade.order']) assert(!rule.test(url(api)));
assert(!rule.test(url(search).replace('goofish.com', 'goofish.com.evil.test')));
assert(fs.existsSync(path.join(__dirname, '../xianyu.js')));
const mocks = [...plugin.matchAll(/~= \/(.+)\/ then response\.body\.mock/g)].map(match => new RegExp(match[1]));
assert.equal(mocks.length, 4);
for (const host of ['video-zb.cloudvideocdn.taobao.com', 'video-sh.cloudvideocdn.taobao.com']) {
  assert(mocks[2].test(`https://${host}/mama_searchad_algo_upload/123/a.mp4`));
  assert(!mocks[2].test(`https://${host}/normal/a.mp4`));
  assert(!mocks[2].test(`https://${host}/mama_searchad_algo_upload_other/a.mp4`));
  assert(hosts.includes(host));
}
assert(mocks[3].test('https://df.tanx.com/spf3?e=1'));
assert(!mocks[3].test('https://df.tanx.com/spf3other'));
assert(!mocks[3].test('https://df.tanx.com.evil.test/spf3'));
for (const file of process.argv.slice(2)) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')).log.entries;
  const counts = mocks.map(() => 0);
  let pages = 0;
  for (const entry of entries) {
    const requestUrl = entry.request.url;
    if (rule.test(requestUrl)) pages++;
    mocks.forEach((mock, index) => {
      if (!mock.test(requestUrl)) return;
      counts[index]++;
      assert(hosts.includes(new URL(requestUrl).hostname));
      if (index === 2) assert(new URL(requestUrl).pathname.startsWith('/mama_searchad_algo_upload/'));
      if (index === 3) assert.equal(new URL(requestUrl).pathname, '/spf3');
    });
  }
  console.log(`${path.basename(file)}: 请求=${entries.length}, 页面接口=${pages}, 开屏/曝光/视频/跟踪=${counts.join('/')}`);
}
console.log(`通过 ${checks} 次脚本执行检查，以及接口边界和 MitM 覆盖检查；使用合成数据，不代表真机验证。`);
