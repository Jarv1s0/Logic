/**
 * 微博国内版响应净化，由本仓库独立维护。
 * 不注入设置入口、不加载远程代码、不写入持久配置；未知结构保持原样。
 */
const BUSINESS_ROUTES = Object.freeze({
  '/2/statuses/container_timeline_hot': 'home',
  '/2/statuses/container_positive': 'home',
  '/2/guest/container_timeline_hot': 'home',
  '/2/statuses/container_timeline_unread': 'home',
  '/2/statuses/container_timeline': 'home',
  '/2/live/media_homelist': 'live',
  '/2/remind/hometab_dot': 'avatar',
  '/2/remind/unread_count': 'unread',
  '/2/messageflow/notice': 'notice',
  '/2/statuses/container_detail': 'detail',
  '/2/statuses/container_detail_comment': 'detail',
  '/2/statuses/container_detail_forward': 'detail',
  '/2/comments/build_comments': 'detail',
  '/2/search/finder': 'discovery',
  '/2/search/container_timeline': 'discovery',
  '/2/search/container_discover': 'discovery',
  '/2/!/was/finder/searchbarchange': 'search',
  '/2/cardlist': 'search',
  '/2/flowpage': 'search',
  '/2/searchall': 'search',
  '/2/profile/me': 'profile',
  '/2/profile/container_timeline': 'profile',
  '/2/video/flow_stream': 'video',
  '/2/video/flow_stream_cache': 'video',
  '/2/push/daily': 'adConfig',
  '/2/push/active': 'activeAdConfig',
  '/2/push/info': 'adConfig',
  '/2/guest/push_active': 'activeAdConfig',
  '/2/groups/allgroups/v2': 'groups',
  '/2/client/get_grayfeature': 'homeSuperTopic',
  '/2/client/abserver_list': 'refresh',
  '/2/checkin/show': 'checkin',
  '/2/video/remind_info': 'reminder',
  '/2/video/home_channels': 'videoChannels'
});
const BOOT_ROUTES = Object.freeze({
  'bootpreload.uve.weibo.com/v2/ad/preload': 'boot',
  'bootrealtime.uve.weibo.com/v3/ad/realtime': 'boot',
  'wbapp.uve.weibo.com/wbapplua/wbpullad.lua': 'boot'
});
const ME_CARD_PROMOTIONS = new Set([
  '100505_-_ewbshopping1', '100505_-_diamond', '100505_-_renwu', '100505_-_jingran2026',
  '100505_-_aibanliao', '100505_-_newlvzhou2', '100505_-_mianliuliang', '100505_-_worldcup'
]);
const PROMOTION_REMINDER_KEYS = [
  'jieqian', 'jieqian1', 'jieqian2', 'jieqian3', 'licai', 'licai1', 'licai2', 'licai3',
  'jinrong1', 'jinrong2', 'jinrong3', 'xinyongka1', 'xinyongka2', 'xinyongka3',
  'fafacredit', 'fenqi', 'creditcard', 'RedPackets', 'productcenter_dot',
  'card_privilegeone', 'card_privilegetwo', 'card_background'
];
const PROMOTION_FLOAT_TYPES = new Set([
  'ad_launch', 'ad', 'ad_red_packet', 'ad_vision_float_home', 'ad_vision_float',
  'red_pocket', 'find_red_packet', 'ug_high_priority', 'wb_custom_recommend'
]);

(function () {
  const original = $response.body;
  let body = original;
  const config = {
    homeAutoRefresh: true, hideHomeTabAvatar: true, hideHomeTabRedDot: true,
    hideMessageTabNumber: true, hideFeedAiButton: true, hidePlaybackCompletionActions: true
  };
  try {
    const stored = JSON.parse($persistentStore.read('mainConfig'));
    if (isObject(stored)) for (const key of Object.keys(config)) {
      if (typeof stored[key] === 'boolean' || (key === 'homeAutoRefresh' && stored[key] === null)) config[key] = stored[key];
    }
  } catch (_) {}
  const route = resolveRoute($request.url);
  const isDiscovery = route === 'discovery';
  try {
    if (route && typeof body === 'string') {
      const data = JSON.parse(body);
      if (isObject(data)) {
        const before = JSON.stringify(data);
        processResponse(data);
        const after = JSON.stringify(data);
        if (after !== before) body = after;
      }
    }
  } catch (_) {
    // 只在处理完整成功后替换正文，异常时不返回半处理结果。
  }
  $done({ body });

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function resolveRoute(url) {
    const match = /^https?:\/\/([^/?#]+)(\/[^?#]*)?(?:[?#]|$)/i.exec(url);
    if (!match) return null;
    const host = match[1].toLowerCase(), path = (match[2] || '/').toLowerCase();
    if (/^m?api\.weibo\.c(?:n|om)$/.test(host)) return BUSINESS_ROUTES[path] || null;
    if (host === 'm.weibo.cn' && path === '/c/mecard/cardv3') return 'meCards';
    return BOOT_ROUTES[host + path] || null;
  }
  function processResponse(data) {
    switch (route) {
      case 'home': case 'discovery': case 'search': case 'profile': case 'detail': case 'video':
        cleanContent(data);
        if (route === 'detail') cleanDetail(data);
        break;
      case 'notice':
        if (Array.isArray(data.messages)) data.messages = data.messages.filter(message =>
          Number(message?.type) !== 47 || (!['广告', '廣告', '荐读', '粉丝头条'].includes(message.msg_card?.ad_tag?.text)
            && message.msg_card?.actionlog?.source !== 'ad'));
        break;
      case 'meCards': cleanMeCards(data); break;
      case 'avatar':
        if (config.hideHomeTabAvatar && data.bubble_type === 0 && data.scene === 0 && data.group_type === 1
          && typeof data.text === 'string' && typeof data.extparams === 'string' && typeof data.image === 'string'
          && /^https:\/\/tvax[1-9]\d*\.sinaimg\.cn\//.test(data.image)) data.image = '';
        break;
      case 'unread':
        if (Number.isSafeInteger(data.timeStamp) && isObject(data.remind_settings)) {
          for (const key of PROMOTION_REMINDER_KEYS) {
            if (isObject(data.ext)) clearCount(data.ext, key);
            if (isObject(data.ext_new?.[key])) clearCount(data.ext_new[key], 'count');
          }
          if (config.hideHomeTabRedDot) for (const key of ['status_home', 'status_hot_home']) clearCount(data, key);
          if (config.hideMessageTabNumber) clearCount(data, 'folder_total_unread');
        }
        break;
      case 'refresh': {
        for (const key of ['p_feed_ai_vote_ios_enable', 'p_feed_ruibin_enable_ai_vote',
          'p_vote_topic_guide_enable', 'p_ad_redPacket_enable']) {
          if (data.value?.[key] === true) data.value[key] = false;
          else if (data.value?.[key] === 'true') data.value[key] = 'false';
        }
        const key = 'p_feed_home_auto_refresh_ea1', value = data.value?.[key];
        if (typeof config.homeAutoRefresh !== 'boolean' || !isObject(data.value)) break;
        if (typeof value === 'boolean') data.value[key] = config.homeAutoRefresh;
        else if (value === 'true' || value === 'false') data.value[key] = String(config.homeAutoRefresh);
        break;
      }
      case 'homeSuperTopic': {
        const key = 'p_sg_left_discovery_positive_a_enable';
        if (isObject(data.ab_data)) {
          if (data.ab_data[key] === 'true') data.ab_data[key] = 'false';
          else if (data.ab_data[key] === true) data.ab_data[key] = false;
        }
        break;
      }
      case 'activeAdConfig': case 'adConfig': {
        if (route === 'activeAdConfig') hideHomeTaskButton(data.feed_redpacket);
        if (Array.isArray(data.floating_windows)) data.floating_windows = data.floating_windows.filter(window =>
          window?.type !== 'native' || !PROMOTION_FLOAT_TYPES.has(window.subtype));
        if (Array.isArray(data.floating_windows_force_show)) data.floating_windows_force_show =
          data.floating_windows_force_show.filter(type => !PROMOTION_FLOAT_TYPES.has(type));
        const ads = data.ug_adv;
        if (!isObject(ads)) break;
        disableFlag(ads.screen_ad, 'effective'); disableFlag(ads.feed_ad, 'effective');
        for (const entry of Array.isArray(ads.feed_ad_arr) ? ads.feed_ad_arr : []) disableFlag(entry, 'effective');
        for (const entry of Array.isArray(ads.hot_ad?.screen_ad) ? ads.hot_ad.screen_ad : []) disableFlag(entry, 'effective');
        disableFlag(ads.intercept_ad, 'switch');
        break;
      }
      case 'boot':
        if (Array.isArray(data.ads)) data.ads = [];
        if (Array.isArray(data.cached_ad?.ads)) data.cached_ad.ads = [];
        if (Array.isArray(data.ads) && /\/ad\/preload(?:[?#]|$)/i.test($request.url)) data.last_ad_show_interval = 86400;
        break;
      case 'groups': preferLatestGroup(data); break;
      case 'checkin': disableFlag(data, 'show'); break;
      case 'live':
        if (data.code === 100000 && Array.isArray(data.data)) data.data = [];
        break;
      case 'reminder':
        if (typeof data.exist_remind === 'boolean') {
          data.exist_remind = false;
          for (const key of ['bubble_dismiss_time', 'image_dismiss_time']) clearCount(data, key);
          for (const key of ['image', 'tag_image_english', 'tag_image_english_dark', 'tag_image_normal', 'tag_image_normal_dark']) {
            if (typeof data[key] === 'string') data[key] = '';
          }
        }
        break;
      // 频道和排序不表示广告；没有明确广告标志时透传。
      case 'videoChannels': break;
    }
  }
  function clearCount(object, key) {
    if (Number.isSafeInteger(object[key]) && object[key] >= 0) object[key] = 0;
  }
  function disableFlag(object, key) {
    if (!isObject(object)) return;
    if (object[key] === true) object[key] = false;
    else if (object[key] === 1) object[key] = 0;
    else if (object[key] === '1') object[key] = '0';
  }
  function hideHomeTaskButton(button) {
    if (!isObject(button) || !['0', '1'].includes(button.type)
      || typeof button.icon !== 'string' || typeof button.scheme !== 'string') return;
    const isCheckin = /^https:\/\/m\.weibo\.cn\/c\/checkin(?:[?#]|$)/i.test(button.scheme);
    const isGuestCheckin = /\/(?:hongbao|redpocket_white)\.png(?:[?#]|$)/i.test(button.icon)
      && /^sinaweibo:\/\/login\?(?:[^&#]*&)*ug_guest=1(?:[&#]|$)/i.test(button.scheme);
    if (!isCheckin && !isGuestCheckin) return;
    button.type = '0';
    for (const key of ['icon', 'icon_reverse', 'pre_icon', 'pre_icon_reverse', 'finish_icon', 'guide']) {
      if (typeof button[key] === 'string') button[key] = '';
    }
  }
  function isAd(post) {
    if (!isObject(post)) return false;
    const isFanHeadline = post.mblogtypename === '粉丝头条'
      || post.content_auth_info?.content_auth_title === '粉丝头条'
      || (Array.isArray(post.tag_struct) && post.tag_struct.some(tag =>
        ['粉丝头条', 'fans_headline'].includes(tag?.otype)
        || ['粉丝头条', 'fans_headline'].includes(tag?.tag_name)
        || ['粉丝头条', 'fans_headline'].includes(tag?.name)));
    return isFanHeadline || post.ad_marked === true || Number(post.is_ad) === 1
      || ['广告', '廣告', '热推'].includes(post.mblogtypename)
      || ['广告', '廣告'].includes(post.content_auth_info?.content_auth_title)
      || post.promotion?.type === 'ad' || post.page_info?.actionlog?.source === 'ad'
      || [true, 1, '1'].includes(post.ads_material_info?.is_ads)
      || (['discovery', 'search', 'video'].includes(route) && Number(post.ad_state) === 1);
  }
  function removeItem(item) {
    if (!isObject(item)) return false;
    if (route === 'detail' && isDetailRecommendation(item)) return true;
    const post = item.data ?? item.status ?? item.mblog ?? item;
    if (isAd(post)) return true;
    if (route === 'home' && item.category === 'group'
      && ['super_topic_recommend_card', 'recommend_video_card'].includes(item.trend_name)) return true;
    if (route === 'profile' && isProfilePromotion(item)) return true;
    // 必须移除卡片本身，仅删除 data.tip_msg 会留下背景、关闭按钮和占位高度。
    if (route === 'detail' && item.category === 'detail' && item.type === 'comment_header_tip') return true;
    if (route === 'detail' && (['广告', '廣告', '相关内容', '相关评论', '推荐', '热推', '推薦', '荐读'].includes(item.data?.adType ?? item.adType)
      || item.type === 'trend' || [true, 1, '1'].includes(item.commentAdType)
      || [6, 236].includes(Number(item.data?.card_type)))) return true;
    if (isDiscovery || route === 'search') {
      if ([118, 247].includes(Number(post?.card_type))) return true;
      if (Number(post?.card_type) === 22 && typeof post.scheme === 'string'
        && /^sinaweibo:\/\/messagelist\?(?:[^&#]*&)*send_from=trending_discover_zhisou(?:[&#]|$)/.test(post.scheme)) return true;
    }
    return false;
  }
  function isDetailRecommendation(item) {
    if (!isObject(item)) return false;
    const title = item.header?.title;
    const titleText = typeof title === 'string' ? title : title?.content;
    const dataTitle = item.data?.title;
    const labels = [titleText, item.title, typeof dataTitle === 'string' ? dataTitle : dataTitle?.content,
      item.data?.desc, item.type];
    return labels.some(label => typeof label === 'string' && /推荐|荐读|recommend/i.test(label))
      || Number(item.data?.card_ad_style) === 1
      || (Array.isArray(item.items) && item.items.some(isDetailRecommendation));
  }
  function isProfilePromotion(item) {
    // 不按“设置”文字匹配，保留微博本身及普通模块的设置按钮。
    if (item.itemId === 'weibo_local_settings_v3') return true;
    if (item.category === 'feed') return false;
    if (item.category === 'cell' && item.type === 'title' && item.itemId === 'mine_attent_title') return true;
    if (item.category === 'mine' && item.type === 'mineAttent' && /^100505_-_meattent_-_\d+$/.test(item.itemId)) return true;
    if (['profile_vip_entry', '100505_-_productcenter', '100505_-_promote', '100505_-_newusertask',
      '100505_-_vipkaitong', '100505_-_hongbao2022', '100505_-_adphoto'].includes(item.itemId)) return true;
    if (item.category === 'card' && Number(item.data?.card_type) === 236) return true;
    function matches(value) {
      if (typeof value === 'string') return /^(?:AI\s*角色(?:伴聊)?|造浪吧[！!\s]*国庆(?:档|檔)?)$/i.test(value.trim());
      return isObject(value) && ['content', 'text', 'title'].some(key => matches(value[key]));
    }
    return [item.header?.title, item.title, item.data?.title, item.data?.desc].some(matches);
  }
  function cleanMeCards(response) {
    if (response.ok !== 1 || !isObject(response.data)) return;
    for (const key of ['opened', 'closed']) {
      if (!Array.isArray(response.data[key])) continue;
      response.data[key] = response.data[key].filter(card => {
        if (ME_CARD_PROMOTIONS.has(card?.itemId) || hasMeCardAd(card)) return false;
        if (Array.isArray(card?.items)) {
          card.items = card.items.filter(item => !hasMeCardAd(item)
            && !(card.itemId === '100505_-_mypay_new' && isWalletOffer(item)));
        }
        return true;
      });
    }
  }
  function hasMeCardAd(card) {
    const monitors = card?.adData?.promotion?.monitor_url;
    return Array.isArray(monitors) && monitors.length > 0;
  }
  function isWalletOffer(card) {
    if (card?.category !== 'mine' || card.type !== 'card2') return false;
    const subtitle = card.content?.content;
    return subtitle === '可借额度' || (subtitle === '已临时开通'
      && Array.isArray(card.arrayText?.contents)
      && card.arrayText.contents.some(line => /^\d+(?:\.\d+)?(?:万)?额度$/.test(line?.content)));
  }
  function cleanDetail(data) {
    if (isObject(data.detailInfo?.extend)) {
      delete data.detailInfo.extend.follow_data;
      delete data.detailInfo.extend.ai_vote_info;
    }
    const header = data.pageHeader?.data;
    if (!Array.isArray(header?.items)) return;
    header.items = header.items.filter(item => {
      if (item?.category === 'detail' && item.type === 'share') return false;
      if (item?.category === 'card' && Number(item.data?.card_type) === 248
        && item.data.itemid === 'top_searching' && item.data.is_detail === true) return false;
      if (isDetailRecommendation(item)) return false;
      if (item?.category === 'group' && Array.isArray(item.items) && item.items.length > 0) {
        const kept = item.items.filter(child => !(child?.category === 'card'
          && Number(child.data?.card_type) === 3 && child.data.actionlog?.cardid === 'wbg_goodsadvise'));
        if (kept.length === 0) return false;
        item.items = kept;
      }
      return true;
    });
  }
  function cleanContent(node) {
    if (!isObject(node)) return;
    cleanInterface(node);
    if (route === 'detail') delete node.tip_msg;
    if ((isDiscovery || route === 'search') && isObject(node.loadedInfo)) {
      delete node.loadedInfo.searchBarContent;
      delete node.loadedInfo.headerBack;
    }
    for (const key of ['items', 'statuses', 'cards', 'card_group', 'datas', 'reposts', 'hot_reposts']) {
      if (!Array.isArray(node[key])) continue;
      const kept = [];
      for (const item of node[key]) {
        if (removeItem(item)) continue;
        const hadItems = Array.isArray(item?.items) && item.items.length > 0;
        const card = item?.data;
        const hadBigDay = (isDiscovery || route === 'search') && Number(card?.card_type) === 19
          && Array.isArray(card.group) && card.group.length > 0;
        if (isObject(item)) {
          const post = item.data ?? item.status ?? item.mblog ?? item;
          if (isObject(post)) {
            cleanPostPromotions(post);
            if (route === 'home') cleanHomePictures(post);
          }
          cleanContent(item);
        }
        if (hadBigDay && card.group.length === 0) continue;
        if (route === 'profile' && hadItems && item.items.length === 0) continue;
        kept.push(item);
      }
      node[key] = kept;
    }
    // 只遍历响应容器，不进入 retweeted_status、正文和用户对象。
    for (const key of ['lists', 'channels']) {
      if (Array.isArray(node[key])) for (const child of node[key]) cleanContent(child);
    }
    for (const key of ['data', 'status', 'mblog', 'detailInfo', 'payload', 'header', 'pageHeader', 'channelInfo']) cleanContent(node[key]);
    if (isDiscovery || route === 'search') cleanSearchCard(node);
  }
  function cleanInterface(post) {
    // 个人资料头部的会员推广不在 items 卡片列表中，保留头像、会员图标及用户信息。
    if (route === 'profile' && post.category === 'mine' && post.type === 'header'
      && post.itemId === 'profileme_mine_head'
      && /^vipcenter_out_\d+_adsystem$/.test(post.vipView?.itemId)) delete post.vipView;
    // 投票可以附着在正常微博及被转发原文上，只删除入口，不过滤整条微博。
    for (const status of [post, post.retweeted_status]) {
      if (isObject(status?.extend_info)) delete status.extend_info.ai_vote_info;
      disableFlag(status?.page_info?.media_info, 'vote_is_show');
    }
    if (route === 'home' || route === 'detail') {
      cleanPostAdTags(post);
      cleanPostAdTags(post.retweeted_status);
    }
    const nativeAd = post.extend_info?.ad_nature?.ad_nature;
    if (post.ad_tag_nature?.otype === 'adFeedDarwinTag' && (nativeAd === true || nativeAd === 'true')) {
      delete post.ad_tag_nature;
      delete post.extend_info.ad_nature;
    }
    const cells = post.bottom_bar_dyna?.cell_item;
    if (config.hideFeedAiButton && isObject(cells?.ai_search)) delete cells.ai_search;
    const media = post.page_info?.media_info;
    if (config.hidePlaybackCompletionActions && Array.isArray(media?.play_completion_actions)) media.play_completion_actions = [];
  }
  function cleanPostAdTags(post) {
    if (Array.isArray(post?.tag_struct)) post.tag_struct = post.tag_struct.filter(tag => tag?.otype !== 'adFeedDarwinTag');
  }
  function cleanSearchCard(card) {
    const type = Number(card.card_type);
    if (type === 19 && Array.isArray(card.group)) card.group = card.group.filter(entry =>
      ![entry?.itemid, entry?.action_log?.ext].some(value => typeof value === 'string' && /(?:^|[&|])adid[=:]bigday_[^&|]+/.test(value)));
    if (type === 17) cleanHotSearch(card);
    else if (type === 235 && Array.isArray(card.channel_list)) card.channel_list.forEach(cleanHotSearch);
    if (Array.isArray(card.card_group)) card.card_group = card.card_group.filter(entry => entry?.ad_marked !== true && !entry?.promotion);
  }
  function preferLatestGroup(data) {
    if (!Array.isArray(data.pageDatas)) return;
    const home = data.pageDatas.find(page => page?.pageId === 'homeFeed' || page?.pageDataType === 'homeFeed');
    if (!Array.isArray(home?.categories)) return;
    for (const category of home.categories) {
      if (!Array.isArray(category?.pageDatas)) continue;
      const index = category.pageDatas.findIndex(group => group?.title === '最新微博');
      if (index < 0) continue;
      const [latest] = category.pageDatas.splice(index, 1);
      category.pageDatas.unshift(latest);
      data.defaultPageId = 'homeFeed';
      return;
    }
  }

  function cleanHomePictures(post) {
    if (!isObject(post.pic_infos)) return;
    for (const picture of Object.values(post.pic_infos)) {
      if (typeof picture?.original?.url !== 'string') continue;
      const url = picture.original.url.replace('orh1080', 'oslarge');
      for (const size of ['largest', 'thumbnail', 'large', 'middleplus', 'mw2000', 'bmiddle']) {
        if (isObject(picture[size])) picture[size].url = url;
      }
    }
  }
  function cleanPostPromotions(post) {
    delete post.common_struct;
    delete post.semantic_brand_params;
    if (isObject(post.extend_info)) {
      delete post.extend_info.shopwindow_cards;
      delete post.extend_info.ad_semantic_brand;
    }
  }
  function cleanHotSearch(card) {
    if (!card || typeof card !== 'object') return;
    for (const key of ['group', 'group_unfold']) {
      if (Array.isArray(card[key])) {
        card[key] = card[key].filter(entry => entry?.ad_marked !== true && !entry?.promotion
          && !(typeof entry?.itemid === 'string' && /is_ad_pos|city_code/.test(entry.itemid)));
      }
    }
  }

})();
