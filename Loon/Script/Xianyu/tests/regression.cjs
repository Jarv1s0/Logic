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
for (const api of ['mtop.taobao.idlehome.home.nextfresh', 'mtop.taobao.idle.item.buy.feeds']) {
  expect(api, {sections: [normal, {data: {bizType: 'AD'}}, unknown, null], cursor: 'next'},
    {sections: [normal, unknown, null], cursor: 'next'});
}
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
  'mtop.taobao.idle.item.recommend.list', 'mtop.taobao.idle.item.buy.feeds', mine];
const hosts = plugin.match(/^hostname = (.+)$/m)[1].split(', ');
for (const api of apis) {
  for (const host of ['acs.m.goofish.com', 'g-acs.m.goofish.com']) {
    assert(rule.test(`https://${host}/gw/${api}/1.0/?x=1`));
    assert(hosts.includes(host));
  }
  assert(!rule.test(url(api + '.extra')));
  assert(!rule.test(url(api) + 'extra'));
}
for (const api of ['mtop.taobao.idlemtopsearch.search.shade', 'mtop.idle.message.chat', 'mtop.idle.trade.order']) assert(!rule.test(url(api)));
assert(!rule.test(url(search).replace('goofish.com', 'goofish.com.evil.test')));
assert(fs.existsSync(path.join(__dirname, '../xianyu.js')));
console.log(`通过 ${checks} 次脚本执行检查，以及接口边界和 MitM 覆盖检查；使用合成数据，不代表真机验证。`);
