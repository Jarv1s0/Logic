// 高德地图：清理推广字段并精简首页、我的页面卡片，未知结构保持原样。
// 改编自树先生的 amap-new.js；来源及变更见 Loon/Docs/amap.md。
// 原作声明：当前文件内容仅供个人学习和研究使用，若使用过程中发生任何问题概不负责。

const originalBody = $response.body;
let body = originalBody;

const poiAds = [
  "CouponBanner", "CouponWidget", "CouponMiddleBanner",
  "CouponDetailMiddleBanner", "CouponFooterStickBanner", "CouponPopup",
  "MarketingGoods", "adStoreBigBannerModule", "image_banner",
  "yellowPageAdRecommendModule", "CouponPush"
];
// 房产详情专用模块及其锚点，由用户 HAR 确认；通用商品货架不在其他模板删除。
const houseDetailModules = [
  "houseAgentService", "surroundFacility", "surroundHouseTab", "houseShelf",
  "commonGoodsShelf", "similarShopRecommend", "nearbyRecommendModule",
  "quickLinksPortal", "poiDetailWaterFeedTitle", "poiDetailWaterFeed"
];
const searchAds = ["BrandBannerCard", "CustomerServiceAdEntrances", "CouponBanner"];
const mapAds = [
  "UserAssetsVirtualCard", "FootPrintNewCityDialog",
  "PoiRecommendVirtualCard", "PersonalRecommendVirtualCard"
];
// 仅这两处页面卡片列表按白名单精简，不用于搜索结果。
const homeCards = ["LoginCard", "FrequentLocation"];
// 保留常用地点快捷入口；仅过滤 HAR 中确认的续导航及目的地推荐子卡片。
const hiddenHomeDynamicCards = [
  "VO_G2A3UGG3_CARD_LM2W5Y14", "VO_3TG6YIWC_CARD_SHDHIDHR"
];
const profileCards = [
  "MineNewFootprintCard", "MineNewBEntranceCardV4", "MineNewBEntranceCardV3", "MyOrderCard"
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function filterList(object, key, keep) {
  if (isObject(object) && Array.isArray(object[key])) object[key] = object[key].filter(keep);
}

function removeModules(data, names) {
  const keep = name => !names.includes(name);
  if (isObject(data.modules)) {
    names.forEach(name => { delete data.modules[name]; });
  }
  if (isObject(data.regions)) {
    Object.keys(data.regions).forEach(region => {
      filterList(data.regions, region, keep);
    });
  }
  if (isObject(data.meta)) {
    filterList(data.meta, "half_hidden_modules", keep);
    filterList(data.meta.vo_meta_info, "couponRefreshModules", keep);
  }
}

function filterHouseAnchors(items) {
  return items.filter(item => {
    if (!isObject(item)) return true;
    if (typeof item.anchor === "string") return !houseDetailModules.includes(item.anchor);
    if (!Array.isArray(item.anchor)) return true;
    const kept = item.anchor.filter(name => !houseDetailModules.includes(name));
    if (kept.length === item.anchor.length) return true;
    if (kept.length === 0) return false;
    item.anchor = kept;
    return true;
  });
}

function cleanHouseDetail(data) {
  if (data.template !== "house_all_expt_temp") return;
  removeModules(data, houseDetailModules);
  if (!isObject(data.modules)) return;
  const base = data.modules.baseInfo;
  if (isObject(base) && isObject(base.data) && Array.isArray(base.data.iconsList)) {
    base.data.iconsList = base.data.iconsList.filter(icon => {
      if (!isObject(icon) || icon.type !== "tel" || !isObject(icon.tel_info) ||
          !isObject(icon.tel_info.params) || !Array.isArray(icon.tel_info.params.multiVirtualPhone)) return true;
      const phones = icon.tel_info.params.multiVirtualPhone;
      const kept = phones.filter(phone => !isObject(phone) || !isObject(phone.material) ||
        typeof phone.material.dial_virtual_txt !== "string" || !phone.material.dial_virtual_txt.includes("经纪人提供服务"));
      if (kept.length === phones.length) return true;
      icon.tel_info.params.multiVirtualPhone = kept;
      // 保留其他拨号选项或跳转入口，纯经纪人按钮才整体移除。
      return kept.length > 0 || Array.isArray(icon.tel_info.jump_list) && icon.tel_info.jump_list.length > 0;
    });
  }
  const anchor = data.modules.anchor;
  if (isObject(anchor) && isObject(anchor.data) && Array.isArray(anchor.data.items)) {
    anchor.data.items = filterHouseAnchors(anchor.data.items);
  }
  const belt = data.modules.poiDetailNewBeltV2;
  if (isObject(belt) && isObject(belt.data) && isObject(belt.data.belt) &&
      Array.isArray(belt.data.belt.list)) {
    const items = belt.data.belt.list;
    const kept = filterHouseAnchors(items);
    if (items.length > 0 && kept.length === 0) {
      removeModules(data, ["poiDetailNewBeltV2"]);
    } else {
      belt.data.belt.list = kept;
    }
  }
}

function clearDataList(block) {
  if (isObject(block) && Array.isArray(block.dataList)) block.dataList = [];
}

function cleanHomeStream(stream) {
  const frames = stream.split(/\r?\n\r?\n/);
  let doneIndex = -1;
  let completeIndex = -1;
  let knownHomeContainers = 0;
  const rewritten = frames.map((frame, index) => {
    const lines = frame.split(/\r?\n/);
    const eventLine = lines.find(line => line.startsWith("event:"));
    const event = eventLine ? eventLine.slice(6).trim() : "message";
    const dataLines = lines.filter(line => line.startsWith("data:"));
    if (dataLines.length === 0) return frame;
    // 未知或错误事件不伪装成成功，保持整段原响应。
    if (event !== "data" && event !== "COMPLETE") throw new Error("Unknown SSE event");
    const value = JSON.parse(dataLines.map(line => line.slice(5).replace(/^ /, "")).join("\n"));
    let changed = false;
    if (event === "data" && isObject(value) && isObject(value.component)) {
      const component = value.component;
      const template = isObject(component.data) ? component.data.data : null;
      if (component.type === "container" && isObject(template) &&
          template.template === "aiPmtGenerate" && isObject(template.modules)) {
        Object.keys(template.modules).forEach(key => {
          const card = template.modules[key];
          if (isObject(card) && card.card_id === "C2TaxiBizContainer" &&
              isObject(card.data) && isObject(card.data.cardData) &&
              Array.isArray(card.data.cardData.dataList)) {
            // 首页目的地打车推荐使用独立容器，保留事件及布局，仅清空推荐列表。
            knownHomeContainers++;
            if (card.data.cardData.dataList.length > 0) {
              clearDataList(card.data.cardData);
              changed = true;
            }
          }
          if (isObject(card) && card.card_id === "WaterfallContainer" &&
              isObject(card.data) && Array.isArray(card.data.list)) {
            // HAR 中服务端已有 list: [] 的成功容器；保留容器及区域引用。
            knownHomeContainers++;
            if (card.data.list.length > 0) {
              card.data.list = [];
              changed = true;
            }
          }
          if (isObject(card) && card.card_id === "NestCard" && isObject(card.data) &&
              isObject(card.data.props) && Array.isArray(card.data.props.children)) {
            const children = card.data.props.children;
            const kept = children.filter(child => !isObject(child) || !isObject(child.meta) ||
              !hiddenHomeDynamicCards.includes(child.meta.dy_card_id));
            if (kept.length !== children.length) {
              // 仅过滤已识别的子卡片，保留 NestCard 外层及整个事件。
              card.data.props.children = kept;
              knownHomeContainers++;
              changed = true;
            }
          }
        });
      }
      if (value.is_done === true && typeof value.has_more === "boolean" &&
          component.type === "markdown" && component.text === "" && component.displayText === "") {
        doneIndex = index;
        if (value.has_more) {
          value.has_more = false;
          changed = true;
        }
      }
    }
    if (event === "COMPLETE" && isObject(value) && Object.keys(value).length === 0) {
      completeIndex = index;
    }
    if (!changed) return frame;
    // 保留 event、id、注释等 SSE 字段，以及所有事件的原始顺序和 seq。
    const firstDataIndex = lines.findIndex(line => line.startsWith("data:"));
    return lines.filter((line, lineIndex) => !line.startsWith("data:") || lineIndex === firstDataIndex)
      .map(line => line.startsWith("data:") ? "data: " + JSON.stringify(value) : line).join("\n");
  });
  if (knownHomeContainers === 0 || doneIndex < 0 || completeIndex <= doneIndex) return stream;
  return rewritten.every((frame, index) => frame === frames[index]) ? stream : rewritten.join("\n\n");
}

try {
  if (/^https:\/\/ai\.amap\.com\/v1\/ai_rec\/home_qs(?:\?|$)/.test($request.url)) {
    body = cleanHomeStream(originalBody);
  } else {
    const obj = JSON.parse(originalBody);
    const before = JSON.stringify(obj);
    const match = /^https:\/\/([^/?#]+)(\/[^?#]*)/.exec($request.url);
    const route = match ? match[1] + match[2] : "";
    if (isObject(obj) && isObject(obj.data)) {
      const data = obj.data;
      switch (route) {
        case "m5.amap.com/ws/faas/amap-navigation/main-page":
          filterList(data, "cardList", card =>
            !isObject(card) || typeof card.dataKey !== "string" || homeCards.includes(card.dataKey));
          break;
        case "m5.amap.com/ws/faas/amap-navigation/main-page-assets":
          filterList(data.pull3, "msgs", message =>
            !isObject(message) || !["1", 1, true].includes(message.is_ad));
          break;
        case "m5.amap.com/ws/shield/dsp/profile/index/nodefaasv3":
          filterList(data, "cardList", card =>
            !isObject(card) || typeof card.dataKey !== "string" || profileCards.includes(card.dataKey));
          break;
        case "m5-zb.amap.com/ws/boss/car/order/content_info":
          if (isObject(data.lubanData)) {
            ["skin", "popup", "banner"].forEach(key => clearDataList(data.lubanData[key]));
          }
          if (isObject(data.matrixData)) clearDataList(data.matrixData.c3DiversionCard);
          break;
        case "info.amap.com/ws/shield/search/poi/detail":
          removeModules(data, poiAds);
          cleanHouseDetail(data);
          break;
        case "m5.amap.com/ws/shield/search_poi/search/sp":
          removeModules(data, searchAds);
          // 搜索结果不按 card_id 白名单过滤，保留未知及正常卡片。
          break;
        case "m5.amap.com/ws/info_bff/tradeUnionPortal":
          if (data.template === "hotelUnionPortal") removeModules(data, ["CouponPopup"]);
          break;
        case "m5-zb.amap.com/ws/promotion-web/resource":
        case "m5-zb.amap.com/ws/promotion-web/resource/home":
          delete data.banner;
          delete data.popup;
          if (isObject(data.other) && isObject(data.other.data)) {
            filterList(data.other.data.icon, "icon_list", icon =>
              !isObject(icon) || icon.icon_id !== "78888" || icon.inner_type !== 5601);
          }
          break;
        case "m5.amap.com/ws/shield/scene/recommend":
          if (Array.isArray(data.shadingWords)) data.shadingWords = [];
          else if (isObject(data.shadingWords)) data.shadingWords = {};
          break;
        case "m5.amap.com/ws/valueadded/alimama/splash_screen":
          if (Array.isArray(data.ad)) {
            data.ad.forEach(ad => {
              if (!isObject(ad)) return;
              if (isObject(ad.set) && isObject(ad.set.setting)) ad.set.setting.display_time = 0;
              if (Array.isArray(ad.creative)) {
                ad.creative.forEach(creative => {
                  if (!isObject(creative)) return;
                  creative.start_time = 3818332800;
                  creative.end_time = 3818419199;
                });
              }
            });
          }
          break;
        case "m5.amap.com/ws/faas/amap-navigation/main-page-aiqs":
          filterList(data, "mapBizList", item => !isObject(item) || !mapAds.includes(item.dataKey));
          break;
      }
    }
    const after = JSON.stringify(obj);
    if (after !== before) body = after;
  }
} catch (error) {
  // 不记录响应正文或请求参数，解析失败时透传。
  console.log("高德净化：响应处理失败，已保留原响应。");
}

$done({ body });
