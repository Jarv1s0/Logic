const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Loon/Script/Amap/amap-new.js'), 'utf8');
const plugin = fs.readFileSync(path.join(root, 'Loon/Amap_remove_ads.lpx'), 'utf8');
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
  'm5.amap.com/ws/faas/amap-navigation/main-page-aiqs',
  'm5.amap.com/ws/faas/amap-navigation/main-page',
  'm5.amap.com/ws/shield/dsp/profile/index/nodefaasv3',
  'ai.amap.com/v1/ai_rec/home_qs'
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

// 推广 dataKey 为合成测试标识，不代表已获取截图对应的真实响应。
test('旧首页下拉隐藏导航和常用地点卡片，保留登录入口', () => {
  const keep = [{ dataKey: 'LoginCard' }];
  const hidden = ['ContinueNavigationCard', 'FrequentLocation', 'FixturePromotion'].map(dataKey => ({ dataKey }));
  const result = data(routes[9], { cardList: [...keep, ...hidden], mapBizList: [{ dataKey: 'FindCarVirtualCard' }], normal: 1 });
  assert.deepEqual(result.cardList, keep);
  assert.deepEqual(result.mapBizList, [{ dataKey: 'FindCarVirtualCard' }]);
  assert.equal(result.normal, 1);
});

test('我的页面保留足迹、入口、订单，移除下拉推广卡片', () => {
  const keep = ['MineNewFootprintCard', 'MineNewBEntranceCardV4', 'MineNewBEntranceCardV3', 'MyOrderCard'].map(dataKey => ({ dataKey }));
  const result = data(routes[10], { cardList: [...keep, { dataKey: 'FixturePromotion' }], memberInfo: { level: 1 }, footPrintV2: { count: 2 } });
  assert.deepEqual(result.cardList, keep);
  assert.deepEqual(result.memberInfo, { level: 1 });
  assert.deepEqual(result.footPrintV2, { count: 2 });
});

test('页面卡片结构未知时透传，推广专用列表可清空', () => {
  for (const route of [routes[9], routes[10]]) {
    assert.deepEqual(data(route, { cardList: [{ dataKey: 'FixturePromotion' }] }).cardList, []);
    for (const cardList of [{}, null, [null, {}, 'unknown', { dataKey: 1 }]]) {
      const result = run(route, { data: { cardList } });
      assert.equal(result.body, result.original);
      assert.deepEqual(result.logs, []);
    }
  }
});

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

const houseModules = ['houseAgentService', 'surroundFacility', 'surroundHouseTab', 'houseShelf', 'commonGoodsShelf', 'similarShopRecommend', 'nearbyRecommendModule', 'quickLinksPortal', 'poiDetailWaterFeedTitle', 'poiDetailWaterFeed'];

test('房产详情分批移除理想居所入口及好去处标题、信息流，同步清理引用', () => {
  const targets = ['quickLinksPortal', 'poiDetailWaterFeedTitle', 'poiDetailWaterFeed'];
  const keep = { poiMapModule: {}, combineReviews: {}, Unknown: {} };
  for (const names of [['quickLinksPortal'], ['poiDetailWaterFeedTitle', 'poiDetailWaterFeed'], ['poiDetailWaterFeed']]) {
    const input = { template: 'house_all_expt_temp', modules: {
      ...keep, ...Object.fromEntries(names.map(name => [name, { data: { fixture: true } }])),
      anchor: { data: { items: [{ anchor: targets }, { anchor: ['combineReviews'] }] } }
    }, regions: { feedContent: ['poiDetailWaterFeed'], main: ['quickLinksPortal', 'combineReviews'] },
    meta: { half_hidden_modules: ['quickLinksPortal', 'Unknown'] } };
    const result = data(routes[1], input);
    assert.deepEqual(result.modules, { ...keep, anchor: { data: { items: [{ anchor: ['combineReviews'] }] } } });
    assert.deepEqual(result.regions, { feedContent: [], main: ['combineReviews'] });
    assert.deepEqual(result.meta.half_hidden_modules, ['Unknown']);
    for (const template of ['restaurant', 'hotelUnionPortal', undefined]) {
      const other = { ...input, template };
      const unchanged = run(routes[1], { data: other });
      assert.equal(unchanged.body, unchanged.original);
    }
  }
});

test('房产详情移除服务、配套、房源和相关推荐，保留基础信息与导航', () => {
  const keep = { baseInfo: { data: { title: 'fixture' } }, poiMapModule: {}, poiDetailBottomBar: { data: { items: [{ key: 'navi' }, { key: 'collect' }] } }, combineReviews: {}, Unknown: {} };
  const input = {
    template: 'house_all_expt_temp', modules: { ...keep, ...Object.fromEntries(houseModules.map(name => [name, {}])) },
    regions: { listContent: ['baseInfo', ...houseModules, 'combineReviews'], other: ['poiMapModule'], malformed: {} },
    meta: { half_hidden_modules: [...houseModules, 'Unknown'], vo_meta_info: { couponRefreshModules: [...houseModules, 'Unknown'] } }
  };
  const result = data(routes[1], input);
  assert.deepEqual(result.modules, keep);
  assert.deepEqual(result.regions, { listContent: ['baseInfo', 'combineReviews'], other: ['poiMapModule'], malformed: {} });
  assert.deepEqual(result.meta.half_hidden_modules, ['Unknown']);
  assert.deepEqual(result.meta.vo_meta_info.couponRefreshModules, ['Unknown']);
  // 通用商品货架及周边模块在其他地点模板仍保留。
  for (const template of ['hotelUnionPortal', 'restaurant', undefined]) {
    const original = { ...input, template };
    assert.deepEqual(data(routes[1], original), JSON.parse(JSON.stringify(original)));
  }
});

test('房产标签和配套快捷入口清理模块引用，未知入口及混合引用保留', () => {
  const items = [{ title: '房源', anchor: ['houseShelf'] }, { title: '服务', anchor: ['houseAgentService'] },
    { title: '配套', anchor: ['surroundFacility'] }, { title: '评价', anchor: ['combineReviews'] },
    { title: '混合', anchor: ['surroundFacility', 'Unknown'] }, { title: '未知', anchor: [] }, null, {}, { anchor: 1 }];
  const result = data(routes[1], { template: 'house_all_expt_temp', modules: {
    anchor: { data: { leastShowCount: 4, items } },
    poiDetailNewBeltV2: { data: { belt: { list: [{ key: 'traffic', anchor: 'surroundFacility' }, { key: 'normal', anchor: 'Unknown' }] } } }
  } });
  assert.deepEqual(result.modules.anchor.data.items, [items[3], { title: '混合', anchor: ['Unknown'] }, ...items.slice(5)]);
  assert.equal(result.modules.anchor.data.leastShowCount, 4);
  assert.deepEqual(result.modules.poiDetailNewBeltV2.data.belt.list, [{ key: 'normal', anchor: 'Unknown' }]);
  const cleared = data(routes[1], { template: 'house_all_expt_temp', modules: {
    poiDetailNewBeltV2: { data: { belt: { list: [{ anchor: 'surroundFacility' }] } } }
  }, regions: { other: ['poiMapModule', 'poiDetailNewBeltV2'] } });
  assert.equal(cleared.modules.poiDetailNewBeltV2, undefined);
  assert.deepEqual(cleared.regions.other, ['poiMapModule']);
});

test('房产电话仅过滤明确的经纪人拨号选项，保留普通电话及未知结构', () => {
  const broker = { material: { dial_virtual_txt: '测试经纪人提供服务' }, params: { fixture: true } };
  const ordinary = { material: { dial_virtual_txt: '物业联系电话' }, params: { fixture: true } };
  const input = { template: 'house_all_expt_temp', modules: { baseInfo: { data: { iconsList: [
    { type: 'map' }, { type: 'tel', tel_info: { params: { multiVirtualPhone: [broker] }, jump_list: [] } },
    { type: 'tel', tel_info: { params: { multiVirtualPhone: [broker, ordinary, null, {}] } } },
    { type: 'tel', tel_info: { params: { multiVirtualPhone: {} } } }, null
  ] } } } };
  const result = data(routes[1], input);
  const expected = structuredClone(input);
  expected.modules.baseInfo.data.iconsList.splice(1, 1);
  expected.modules.baseInfo.data.iconsList[1].tel_info.params.multiVirtualPhone = [ordinary, null, {}];
  assert.deepEqual(result, expected);
  assert.deepEqual(data(routes[1], { ...input, template: 'other' }), { ...input, template: 'other' });
  const otherJump = data(routes[1], { template: 'house_all_expt_temp', modules: { baseInfo: { data: {
    iconsList: [{ type: 'tel', tel_info: { params: { multiVirtualPhone: [broker] }, jump_list: [{ fixture: 'other' }] } }]
  } } } });
  assert.deepEqual(otherJump.modules.baseInfo.data.iconsList[0].tel_info.params.multiVirtualPhone, []);
  assert.deepEqual(otherJump.modules.baseInfo.data.iconsList[0].tel_info.jump_list, [{ fixture: 'other' }]);
});

test('房产详情缺字段及模块类型变化时原样透传', () => {
  for (const modules of [null, [], {}, { anchor: null, poiDetailNewBeltV2: {} },
    { anchor: { data: { items: {} } }, poiDetailNewBeltV2: { data: { belt: { list: {} } } } }]) {
    const result = run(routes[1], { data: { template: 'house_all_expt_temp', modules } });
    assert.equal(result.body, result.original);
  }
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
    '{ "data": { "lubanData": {"popup": {"dataList": {}}}, "ad": {}, "shadingWords": null, "mapBizList": {}, "cardList": {} } }'];
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

test('HAR 首页 SSE 接口交给响应脚本，其他 AI 路径不受影响', () => {
  for (const suffix of ['', '?scene=home', '?scene=home&page=2']) {
    const url = 'https://ai.amap.com/v1/ai_rec/home_qs' + suffix;
    assert.ok(rejectRules.every(regex => !regex.test(url)));
    assert.equal(scriptRules.filter(rule => rule.regex.test(url)).length, 1);
  }
  for (const path of ['nav_start', 'home_qs_new', 'home_qs/other', 'chat']) {
    const url = 'https://ai.amap.com/v1/ai_rec/' + path + '?scene=home';
    assert.ok(rejectRules.every(regex => !regex.test(url)));
    assert.ok(scriptRules.every(rule => !rule.regex.test(url)));
  }
});

function homeStream(newline = '\n') {
  // 使用 HAR 中的协议形状；会话及卡片内容为合成值。
  const container = { seq: '1', is_done: false, component: { type: 'container', is_done: true, data: { data: {
    template: 'aiPmtGenerate', regions: { content: ['AiCardContainer_0'] },
    modules: { AiCardContainer_0: { card_id: 'WaterfallContainer', data: { list: [{ title: 'fixture-promotion' }] } } }
  } } } };
  const functional = { seq: '2', component: { type: 'container', data: { data: {
    template: 'aiPmtGenerate', modules: { AiCardContainer_0: { card_id: 'NestCard', data: { props: { fixture: true } } } }
  } } } };
  const done = { is_done: true, has_more: true, next_page_num: 3, seq: '3', session_id: 'fixture-session', component: { type: 'markdown', text: '', displayText: '', is_done: false } };
  return ['event: data', 'data: ' + JSON.stringify(container), '', 'event: data', 'data: ' + JSON.stringify(functional), '', 'event: data', 'id: 3', 'data: ' + JSON.stringify(done), '', 'event: COMPLETE', 'data: {}', '', ''].join(newline);
}

function streamMessages(body) {
  return body.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5)));
}

test('首页 SSE 保留完整事件链和功能卡片，仅清空瀑布列表并停止分页', () => {
  for (const newline of ['\n', '\r\n']) {
    const input = homeStream(newline);
    const before = streamMessages(input);
    const result = run(routes[11], input);
    assert.deepEqual(result.logs, []);
    assert.ok(result.body.includes('event: COMPLETE'));
    assert.ok(result.body.includes('id: 3'));
    const messages = streamMessages(result.body);
    assert.equal(messages.length, before.length);
    assert.deepEqual(messages.map(message => message.seq), before.map(message => message.seq));
    const expected = structuredClone(before);
    expected[0].component.data.data.modules.AiCardContainer_0.data.list = [];
    expected[2].has_more = false;
    assert.deepEqual(messages, expected);
    assert.equal(run(routes[11], result.body).body, result.body);
  }
});

test('首页 SSE 保留思考事件、空容器及 SSE 元数据，多行 data 可解析', () => {
  const thinking = 'event: data\nid: 0\n: fixture-comment\ndata: {"seq":"0","component":{"type":"container","think_type":1,"is_done":true}}\n\n';
  const empty = 'event: data\ndata: {"seq":"empty","component":{"type":"container","data":{"data":{"template":"aiPmtGenerate","modules":{"AiCardContainer_0":{"card_id":"WaterfallContainer","data":{"list":[]}}}}}}}\n\n';
  const input = thinking + empty + homeStream().replace('data: {"seq":"1",', 'data: {\ndata: "seq":"1",');
  const result = run(routes[11], input);
  assert.ok(result.body.startsWith(thinking + empty));
  assert.equal(streamMessages(result.body).length, 6);
  assert.ok(!result.body.includes('fixture-promotion'));
});

test('首页 SSE 仅移除已识别的导航与常用地点子卡片，保留容器和未知子卡片', () => {
  const messages = streamMessages(homeStream());
  const children = [
    { meta: { dy_card_id: 'VO_G2A3UGG3_CARD_LM2W5Y14' }, data: { bizData: { data: { buttonText: '导航' } } } },
    { meta: { dy_card_id: 'VO_KHYZDF9G_CARD_OC67DFOU' }, data: { scrollButton: { list: [1] } } },
    { meta: { dy_card_id: 'UnknownCard' }, data: { normal: true } },
    null, {}, { meta: null }
  ];
  messages[1].component.data.data.modules.AiCardContainer_0.data.props.children = children;
  const input = messages.map((message, index) => 'event: ' + (index === messages.length - 1 ? 'COMPLETE' : 'data') + '\ndata: ' + JSON.stringify(message)).join('\n\n') + '\n\n';
  const output = streamMessages(run(routes[11], input).body);
  const expected = structuredClone(messages);
  expected[0].component.data.data.modules.AiCardContainer_0.data.list = [];
  expected[1].component.data.data.modules.AiCardContainer_0.data.props.children = children.slice(2);
  expected[2].has_more = false;
  assert.deepEqual(output, expected);
  // 全部子卡片被过滤后仍保留 NestCard 容器及完整事件链。
  messages[1].component.data.data.modules.AiCardContainer_0.data.props.children = children.slice(0, 2);
  const onlyHidden = messages.map((message, index) => 'event: ' + (index === messages.length - 1 ? 'COMPLETE' : 'data') + '\ndata: ' + JSON.stringify(message)).join('\n\n') + '\n\n';
  const cleared = streamMessages(run(routes[11], onlyHidden).body);
  assert.equal(cleared.length, messages.length);
  assert.deepEqual(cleared[1].component.data.data.modules.AiCardContainer_0.data.props.children, []);
  assert.equal(cleared[1].component.data.data.modules.AiCardContainer_0.card_id, 'NestCard');
  const withoutWaterfall = onlyHidden.split('\n\n').slice(1).join('\n\n');
  const noFeed = run(routes[11], withoutWaterfall).body;
  assert.deepEqual(streamMessages(noFeed)[0].component.data.data.modules.AiCardContainer_0.data.props.children, []);
  assert.equal(run(routes[11], noFeed).body, noFeed);
  assert.equal(run(routes[11], withoutWaterfall.replace('event: COMPLETE', 'event: error')).body,
    withoutWaterfall.replace('event: COMPLETE', 'event: error'));
});

test('首页 SSE 未完成、出错或未知结构时原样返回', () => {
  const inputs = [
    'event: data\ndata: {"is_done":false}\n\n',
    'event: COMPLETE\ndata: {}\n\n',
    'event: error\ndata: {"code":500}\n\n',
    'event: data\ndata: not-json\n\n',
    homeStream().replace('event: COMPLETE', 'event: unknown'),
    homeStream().replaceAll('WaterfallContainer', 'UnknownContainer'),
    homeStream().replace('"list":[{"title":"fixture-promotion"}]', '"list":{}'),
    homeStream().replace('"text":""', '"text":"unknown"'),
    'event: COMPLETE\ndata: {}\n\n' + homeStream().split('event: COMPLETE')[0]
  ];
  for (const input of inputs) assert.equal(run(routes[11], input).body, input);
});

test('插件入口无冲突，匹配含参数及无参数请求，排除同名前缀', () => {
  assert.equal(scriptRules.length, 11);
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
    'm5.amap.com/ws/aos_public_travel/recommend_plan',
    'ai.amap.com/v1/ai_rec/nav_start'];
  for (const route of protectedRoutes) assert.ok([...rejectRules, ...scriptRules.map(item => item.regex)].every(regex => !regex.test(`https://${route}?x=1`)));
  const mitm = /^hostname = (.+)$/m.exec(plugin)[1].split(',');
  for (const route of [...routes, ...rejectedRoutes]) assert.ok(mitm.includes(route.split('/')[0]));
});

test('插件脚本和图标全部引用本仓库，并对应存在的文件', () => {
  const urls = [...scriptRules.map(rule => rule.url), /^#!icon = (.+)$/m.exec(plugin)[1]];
  for (const url of urls) {
    assert.ok(url.startsWith('https://raw.githubusercontent.com/Jarv1s0/Logic/master/'));
    const relative = new URL(url).pathname.split('/master/')[1];
    assert.ok(fs.existsSync(path.join(root, relative)));
  }
  const icon = fs.readFileSync(path.join(root, 'icon/gaode.png'));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});
