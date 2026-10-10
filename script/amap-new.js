// 高德地图：仅清理明确的推广字段，未知结构保持原样。
// 改编自树先生的 amap-new.js；来源及变更见 docs/amap.md。
// 原作声明：当前文件内容仅供个人学习和研究使用，若使用过程中发生任何问题概不负责。

const originalBody = $response.body;
let body = originalBody;

const poiAds = [
  "CouponBanner", "CouponWidget", "CouponMiddleBanner",
  "CouponDetailMiddleBanner", "CouponFooterStickBanner", "CouponPopup",
  "MarketingGoods", "adStoreBigBannerModule", "image_banner",
  "yellowPageAdRecommendModule", "CouponPush"
];
const searchAds = ["BrandBannerCard", "CustomerServiceAdEntrances", "CouponBanner"];
const mapAds = [
  "UserAssetsVirtualCard", "FootPrintNewCityDialog",
  "PoiRecommendVirtualCard", "PersonalRecommendVirtualCard"
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function removeModules(data, names) {
  if (isObject(data.modules)) {
    names.forEach(name => { delete data.modules[name]; });
  }
  if (isObject(data.regions)) {
    Object.keys(data.regions).forEach(region => {
      if (Array.isArray(data.regions[region])) {
        data.regions[region] = data.regions[region].filter(name => !names.includes(name));
      }
    });
  }
  if (isObject(data.meta)) {
    if (Array.isArray(data.meta.half_hidden_modules)) {
      data.meta.half_hidden_modules = data.meta.half_hidden_modules.filter(name => !names.includes(name));
    }
    const metaInfo = data.meta.vo_meta_info;
    if (isObject(metaInfo) && Array.isArray(metaInfo.couponRefreshModules)) {
      metaInfo.couponRefreshModules = metaInfo.couponRefreshModules.filter(name => !names.includes(name));
    }
  }
}

function clearDataList(block) {
  if (isObject(block) && Array.isArray(block.dataList)) block.dataList = [];
}

try {
  const obj = JSON.parse(originalBody);
  const before = JSON.stringify(obj);
  const match = /^https:\/\/([^/?#]+)(\/[^?#]*)/.exec($request.url);
  const route = match ? match[1] + match[2] : "";
  if (isObject(obj) && isObject(obj.data)) {
    const data = obj.data;
    switch (route) {
      case "m5-zb.amap.com/ws/boss/car/order/content_info":
        if (isObject(data.lubanData)) {
          ["skin", "popup", "banner"].forEach(key => clearDataList(data.lubanData[key]));
        }
        if (isObject(data.matrixData)) clearDataList(data.matrixData.c3DiversionCard);
        break;
      case "info.amap.com/ws/shield/search/poi/detail":
        removeModules(data, poiAds);
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
        if (Array.isArray(data.mapBizList)) {
          data.mapBizList = data.mapBizList.filter(item => !isObject(item) || !mapAds.includes(item.dataKey));
        }
        break;
    }
  }
  const after = JSON.stringify(obj);
  if (after !== before) body = after;
} catch (error) {
  // 不记录响应正文或请求参数，解析失败时透传。
  console.log("高德净化：响应处理失败，已保留原响应。");
}

$done({ body });
