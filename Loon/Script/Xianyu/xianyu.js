// Logic 原创实现；接口与字段参考来源见 Loon/Docs/xianyu.md。
// 广告按已知标记过滤；我的商品流按用户要求移除全部推荐。
// 解析失败、错误响应及未知结构均透传。
(() => {
  const original = $response.body;
  let result = original;
  try {
    const match = /^https:\/\/(?:g-)?acs\.m\.goofish\.com\/gw\/(mtop\.[a-z0-9_.]+)\/\d+(?:\.\d+)*\/?(?:\?|$)/.exec($request.url);
    const status = $response.statusCode ?? $response.status;
    if (!match || (status !== undefined && !/^200(?:\s|$)/.test(String(status)))) {
      $done({});
      return;
    }
    const root = JSON.parse(original);
    const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
    if (!object(root) || !object(root.data) || !Array.isArray(root.ret) ||
        root.ret.length === 0 || !root.ret.every(value => typeof value === "string" && value.startsWith("SUCCESS::"))) {
      $done({});
      return;
    }
    const before = JSON.stringify(root);
    const data = root.data;
    const adType = value => value === "AD" || value === "mamaAD";
    const sectionAd = item => adType(item?.data?.bizType);
    const filter = (parent, key, predicate) => {
      if (object(parent) && Array.isArray(parent[key])) parent[key] = parent[key].filter(item => !predicate(item));
    };
    switch (match[1]) {
      case "mtop.taobao.idlehome.home.nextfresh":
      case "mtop.taobao.idle.local.home":
        filter(data, "sections", sectionAd);
        break;
      case "mtop.taobao.idle.user.strategy.list":
        if (Array.isArray(data.strategies)) data.strategies = [];
        break;
      case "mtop.taobao.idlehome.home.circle.list":
        filter(data, "circleList", item => item?.bizCode === "saveMoney");
        break;
      case "mtop.taobao.idlemtopsearch.search.shade":
        if (Array.isArray(data.singleShadeWords)) data.singleShadeWords = [];
        break;
      case "mtop.taobao.idlemtopsearch.item.search.activate":
        if (Array.isArray(data.cardList)) data.cardList = [];
        break;
      case "mtop.taobao.idlemtopsearch.search.discover":
        if (Array.isArray(data.resultList)) delete data.resultList;
        break;
      case "mtop.taobao.idle.item.buy.feeds":
        if (Array.isArray(data.sections)) delete data.sections;
        break;
      case "mtop.taobao.idlemtopsearch.search":
        filter(data, "resultList", item => {
          const main = item?.data?.item?.main;
          const flag = main?.exContent?.isAliMaMaAD;
          return flag === true || flag === "true" || adType(main?.clickParam?.args?.biz_type);
        });
        break;
      case "mtop.taobao.idle.item.recommend":
      case "mtop.taobao.idle.item.recommend.list":
        filter(data, "cardList", item => adType(item?.cardData?.bizType));
        break;
      case "mtop.idle.user.page.my.adapter": {
        filter(data.container, "sections", sectionAd);
        // ability 在参考规则中为底部推荐；不改其他非数组结构。
        if (Array.isArray(data.ability)) data.ability = [];
        break;
      }
    }
    const encoded = JSON.stringify(root);
    if (encoded !== before) result = encoded;
  } catch (_) {
    // 保留原响应。
  }
  $done(result === original ? {} : { body: result });
})();
