//参考@yichahucha 的脚本

const launchAdUrl1 = '/interface/sdk/sdkad.php';
const launchAdUrl2 = '/wbapplua/wbpullad.lua';

// function needModify(url) {
// 	if(url.indexOf(launchAdUrl1) > -1 || url.indexOf(launchAdUrl2) > -1) {
// 		return true;
// 	}
// 	return false;
// }

function modifyMain(url, data) {
	if(url.indexOf(launchAdUrl1) > -1) {
		let temp = data.match(/\{.*\}/);
		if(!temp) return data;
		data = JSON.parse(temp);
		if (data.ads) data.ads = [];
		if (data.background_delay_display_time) data.background_delay_display_time = 60 * 60 * 24 * 1000;
		if (data.show_push_splash_ad) data.show_push_splash_ad = false;
		return JSON.stringify(data) + 'OK';
	}
	if(url.indexOf(launchAdUrl2) > -1) {
		data = JSON.parse(data);
		if (data.cached_ad && data.cached_ad.ads) {
			data.cached_ad.ads = [];
		}
		return JSON.stringify(data);
	}
	if (/\/v\d+\/ad\/preload(?:\?|$)/.test(url)) {
		data = JSON.parse(data);
		// 参考 ddgksf2013/weibo_json.js：清理预加载缓存并延长广告展示间隔。
		if (Array.isArray(data.ads)) data.ads = [];
		data.last_ad_show_interval = 86400;
		return JSON.stringify(data);
	}
	return data;
}

var body = $response.body;
var url = $request.url;
// if(needModify(url)) {
try {
  body = modifyMain(url, body);
} catch (error) {
  console.log('微博开屏净化跳过异常响应：' + error.message);
}
// }

$done({ body });
