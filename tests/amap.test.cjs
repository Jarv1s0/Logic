const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script/amap-new.js'), 'utf8');
const plugin = fs.readFileSync(path.join(root, 'plugin/amap-new.lpx'), 'utf8');
const scriptRules = [...plugin.matchAll(/^http-response (\S+) script-path = (\S+),/gm)]
  .map(match => ({ regex: new RegExp(match[1]), url: match[2] }));
const rejectRules = [...plugin.matchAll(/^(\^\S+) reject-dict$/gm)]
  .map(match => new RegExp(match[1]));
const routes = [
  'm5-zb.amap.com/ws/boss/car/order/content_info',
  'info.amap.com/ws/shield/search/poi/detail',
  'm5.amap.com/ws/shield/search_poi/search/sp',
  'm5.amap.com/ws/info_bff/tradeUnionPortal',
  'm5-zb.amap.com/ws/promotion-web/resource',
  'm5-zb.amap.com/ws/promotion-web/resource/home',
  'm5.amap.com/ws/shield/scene/recommend',
  'm5.amap.com/ws/valueadded/alimama/splash_screen',
  'm5.amap.com/ws/faas/amap-navigation/main-page-aiqs'
];
const rejectedRoutes = [
  'amap-aos-info-nogw.amap.com/ws/aos/alimama/splash_screen_rt',
  'm5.amap.com/ws/info_bff/rankingCard',
  'm5.amap.com/ws/shield/search_business/process/marketingOperationStructured',
  'm5.amap.com/ws/shield/search_poi/tips_adv',
  'm5.amap.com/ws/aos/activity/bus/sign/task',
  'm5-zb.amap.com/ws/boss/transportation/diversion/resource/driving',
  'm5-zb.amap.com/ws/boss/transportation/diversion/resource/bus_only_refresh'
];

function run(route, input) {
  const original = typeof input === 'string' ? input : JSON.stringify(input);
  let result;
  let doneCalls = 0;
  const logs = [];
  vm.runInNewContext(source, {
    $request: { url: `https://${route}?test=1` },
    $response: { body: original },
    $done: value => { doneCalls++; result = value.body; },
    console: { log: value => logs.push(value) }
  }, { timeout: 1000 });
  assert.equal(doneCalls, 1);
  return { body: result, logs, original };
}
function data(route, input) { return JSON.parse(run(route, { data: input }).body).data; }

test('搜索保留全部结果及未知模块，只清理已知广告和区域引用', () => {
  const cards = [{ card_id: 'PoiCardUniversal' }, { card_id: 'OtherNormalCard' }, null];
  const result = data(routes[2], {
    modules: { BrandBannerCard: {}, HeaderTipInfo: {}, Unknown: {}, listResult: { data: { list: cards } } },
    regions: { listManage: ['BrandBannerCard', 'HeaderTipInfo', 'Unknown', 'listResult'], malformed: {} }
  });
  assert.deepEqual(result.modules.listResult.data.list, cards);
  assert.equal(result.modules.BrandBannerCard, undefined);
  assert.deepEqual(result.regions.listManage, ['HeaderTipInfo', 'Unknown', 'listResult']);
  assert.deepEqual(result.regions.malformed, {});
});

test('地点详情保留门票、油价、电影、地图标识，清理广告及元数据引用', () => {
  const keep = { scenic_ticket: {}, standardGasPriceShelf: {}, movie_info: {}, poiMapModule: { data: { map: { main_point: { logo: 'logo', card_id: 'normal' } } } } };
  const result = data(routes[1], {
    modules: { ...keep, CouponPopup: {} }, regions: { main: ['CouponPopup', 'scenic_ticket'] },
    meta: { half_hidden_modules: ['CouponPopup', 'scenic_ticket'], vo_meta_info: { couponRefreshModules: ['CouponPopup', 'Unknown'] } }
  });
  assert.deepEqual(result.modules, keep);
  assert.deepEqual(result.regions.main, ['scenic_ticket']);
  assert.deepEqual(result.meta.half_hidden_modules, ['scenic_ticket']);
  assert.deepEqual(result.meta.vo_meta_info.couponRefreshModules, ['Unknown']);
});

test('酒店保留现有布局及模块，不插入不存在的名称', () => {
  const result = data(routes[3], { template: 'hotelUnionPortal', modules: { real_card: {}, CouponPopup: {} }, regions: { content: ['real_card', 'CouponPopup'], widget: ['real_widget'] } });
  assert.deepEqual(result.regions, { content: ['real_card'], widget: ['real_widget'] });
  assert.deepEqual(result.modules, { real_card: {} });
  const otherTemplate = { template: 'other', modules: { CouponPopup: {} } };
  assert.deepEqual(data(routes[3], otherTemplate), otherTemplate);
});

test('打车保留工具箱、分享图标，只清理推广列表', () => {
  const keep = { kingToolBox: { dataList: [{ biz: { id: 'unknown_normal_tool' } }] }, toolMapBar: { share: true } };
  const result = data(routes[0], { lubanData: { ...keep, popup: { dataList: [1] }, banner: { dataList: [2] }, skin: { dataList: [3] } } });
  assert.deepEqual(result.lubanData.kingToolBox, keep.kingToolBox);
  assert.deepEqual(result.lubanData.toolMapBar, keep.toolMapBar);
  for (const key of ['popup', 'banner', 'skin']) assert.deepEqual(result.lubanData[key].dataList, []);
});

test('推广接口保留其他字段，不整段拦截', () => {
  for (const route of [routes[4], routes[5]]) {
    assert.deepEqual(data(route, { banner: {}, popup: {}, service: { enabled: true } }), { service: { enabled: true } });
  }
});

test('搜索框提示清空时保持数组或对象类型，未知类型透传', () => {
  assert.deepEqual(data(routes[6], { shadingWords: ['promotion'] }).shadingWords, []);
  assert.deepEqual(data(routes[6], { shadingWords: { text: 'promotion' } }).shadingWords, {});
  assert.equal(data(routes[6], { shadingWords: 'unknown' }).shadingWords, 'unknown');
});

test('开屏处理兼容空项，不修改非广告字段', () => {
  const result = data(routes[7], { ad: [null, { set: { setting: { display_time: 10 } }, creative: [null, { start_time: 1, end_time: 2 }] }], normal: 1 });
  assert.equal(result.ad[1].set.setting.display_time, 0);
  assert.equal(result.ad[1].creative[1].start_time, 3818332800);
  assert.equal(result.ad[1].creative[1].end_time, 3818419199);
  assert.equal(result.normal, 1);
});

test('地图图层仅删除明确推广标识，保留未知项', () => {
  assert.deepEqual(data(routes[8], { mapBizList: [{ dataKey: 'PoiRecommendVirtualCard' }, { dataKey: 'Normal' }, null, 'unknown'] }).mapBizList,
    [{ dataKey: 'Normal' }, null, 'unknown']);
});

test('所有入口兼容缺字段及类型变化，原始正文逐字透传', () => {
  const inputs = ['null', '[]', '{}', '{ "data": null }', '{ "data": [] }', '{ "data": { "regions": {"listManage": {}}, "modules": [], "meta": {"half_hidden_modules": {}} } }',
    '{ "data": { "lubanData": {"popup": {"dataList": {}}}, "ad": {}, "shadingWords": null, "mapBizList": {} } }'];
  for (const route of routes) for (const input of inputs) {
    const result = run(route, input);
    assert.equal(result.body, input);
    assert.deepEqual(result.logs, []);
  }
});

test('非 JSON 响应透传，日志不暴露响应或参数', () => {
  const input = '<html>private-token</html>';
  const result = run(routes[0], input);
  assert.equal(result.body, input);
  assert.equal(result.logs.length, 1);
  assert.ok(!result.logs[0].includes('private-token'));
});

test('未知路径及同名前缀接口不修改响应', () => {
  for (const route of ['unknown.amap.com/ws/promotion-web/resource', routes[4] + '/other', routes[4] + '_new']) {
    const result = run(route, '{ "data": { "banner": 1 } }');
    assert.equal(result.body, result.original);
  }
});

test('插件入口无冲突，匹配含参数及无参数请求，排除同名前缀', () => {
  assert.equal(scriptRules.length, 8);
  assert.equal(rejectRules.length, 7);
  for (const route of routes) for (const suffix of ['', '?x=1']) {
    const url = `https://${route}${suffix}`;
    assert.equal(scriptRules.filter(rule => rule.regex.test(url)).length, 1);
    assert.ok(rejectRules.every(regex => !regex.test(url)));
  }
  for (const route of rejectedRoutes) for (const suffix of ['', '?x=1']) {
    const url = `https://${route}${suffix}`;
    assert.equal(rejectRules.filter(regex => regex.test(url)).length, 1);
    assert.ok(scriptRules.every(rule => !rule.regex.test(url)));
  }
  for (const rule of [...scriptRules.map(item => item.regex), ...rejectRules]) {
    for (const route of [...routes, ...rejectedRoutes]) {
      assert.ok(!rule.test(`https://${route}_new?x=1`));
      assert.ok(!rule.test(`https://${route}/extra?x=1`));
    }
  }
  const protectedRoutes = ['m5.amap.com/ws/faas/amap-navigation/main-page-assets', 'render.amap.com/ws/render/api/data',
    'm5-zb.amap.com/ws/boss/order/car/feedback/get_card_questions', 'm5-zb.amap.com/ws/boss/order/car/remark/satisfactionConf',
    'm5.amap.com/ws/shield/dsp/profile/index/nodefaasv3', 'm5.amap.com/ws/aos_public_travel/recommend_plan',
    'ai.amap.com/v1/ai_rec/home_qs', 'ai.amap.com/v1/ai_rec/nav_start'];
  for (const route of protectedRoutes) assert.ok([...rejectRules, ...scriptRules.map(item => item.regex)].every(regex => !regex.test(`https://${route}?x=1`)));
  const mitm = /^hostname = (.+)$/m.exec(plugin)[1].split(',');
  for (const route of [...routes, ...rejectedRoutes]) assert.ok(mitm.includes(route.split('/')[0]));
});

test('插件脚本和图标全部引用本仓库，并对应存在的文件', () => {
  const urls = [...scriptRules.map(rule => rule.url), /^#!icon = (.+)$/m.exec(plugin)[1]];
  for (const url of urls) {
    assert.ok(url.startsWith('https://raw.githubusercontent.com/Jarv1s0/Logic/master/'));
    const relative = url.split('/master/')[1];
    assert.ok(fs.existsSync(path.join(root, relative)));
  }
  const icon = fs.readFileSync(path.join(root, 'icon/gaode.png'));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});
