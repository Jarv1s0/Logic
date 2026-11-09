/**
 * 微博国际版净化；根据 ddgksf2013 的规则与处理逻辑适配。
 * https://github.com/ddgksf2013/Rewrite/blob/master/AdBlock/WeiboAds.conf
 * https://github.com/ddgksf2013/Scripts/blob/master/weibo_json.js
 * https://github.com/ddgksf2013/Scripts/blob/master/weibo_search_info.json
 * https://github.com/ddgksf2013/Scripts/blob/master/weibo_search_topic.json
 */
const url = $request.url;
let body = $response.body;
try {
  const response = JSON.parse(body);
  const action = url.match(/[?&]a=([^&]+)/)?.[1];
  if (action === 'get_searching_info') {
    body = JSON.stringify({ data: { expiration_time: '86400', cards: [{ tip: '搜索微博', word: '' }] }, info: '', retcode: 0 });
  } else if (action === 'search_topic' && /[?&]feed(?:&|$)/.test(url)) {
    body = JSON.stringify({ data: [], info: '', retcode: 0, ext: {
      search_hot_simple: { title: '热门搜索', desc: '', more: '更多热搜' },
      search_hot: { title: '微博热搜榜', desc: '实时热点，每分钟更新一次', more: '' },
      search_city: { title: '同城热点', desc: '', more: '' }
    } });
  } else {
    const data = response.data;
    if (action === 'open_app' && data) {
      delete data.close_ad_setting;
      if (data.detail_banner_ad) data.detail_banner_ad = [];
    } else if (action === 'get_coopen_ads' && data) {
      response.data = { display_ad: 1 };
    } else if (action === 'trends' && data) {
      delete data.banner;
      data.order = ['search_topic'];
    } else if (action === 'user_center' && Array.isArray(data?.cards)) {
      data.cards = data.cards.filter(card => card?.items?.[0]?.type !== 'personal_vip');
    } else if (action === 'search_topic' && data) {
      const cards = data.search_topic?.cards;
      if (cards && typeof cards === 'object') {
        data.search_topic.cards = Object.values(cards).filter(card => card?.type !== 'searchtop');
      }
      delete data.trending_topic;
    }
    body = JSON.stringify(response);
  }
} catch (error) {
  console.log('微博国际版净化跳过非 JSON 响应：' + error.message);
}
$done({ body });
