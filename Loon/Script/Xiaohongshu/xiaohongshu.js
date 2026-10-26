// 小红书 Loon 合并脚本：广告净化、下载解锁、去水印和画质增强。
// 解析失败时透传原响应，避免影响正常请求。
const url = ($request && $request.url) || "";
const original = $response.body;
let body = original;

function obj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function arr(v) { return Array.isArray(v); }
function text(v) { return typeof v === "string" ? v : ""; }
function hasAd(item) {
  if (!obj(item)) return false;
  if (item.is_ads === true || Object.prototype.hasOwnProperty.call(item, "ads_info") ||
      Object.prototype.hasOwnProperty.call(item, "ad") || Object.prototype.hasOwnProperty.call(item, "order_cooperate") ||
      Object.prototype.hasOwnProperty.call(item, "card_icon")) return true;
  if (text(item.model_type).match(/^live/i)) return true;
  const attrs = arr(item.note_attributes) ? item.note_attributes : [];
  return attrs.some(x => text(x).match(/goods|cooperate|pgy/i)) ||
    text(item.recommend && item.recommend.track_id).match(/pgy/i);
}
function filterNotes(list) { return arr(list) ? list.filter(x => !hasAd(x)) : list; }
function unlockNote(note) {
  if (!obj(note)) return note;
  if (obj(note.media_save_config)) {
    note.media_save_config.disable_save = false;
    note.media_save_config.disable_watermark = true;
    note.media_save_config.disable_weibo_cover = true;
  }
  if (arr(note.function_switch)) note.function_switch.forEach(x => {
    if (obj(x) && (x.type === "image_download" || x.type === "video_download")) {
      x.enable = true; delete x.reason;
    }
  });
  if (obj(note.share_info) && arr(note.share_info.function_entries)) {
    if (!note.share_info.function_entries.some(x => obj(x) && x.type === "video_download"))
      note.share_info.function_entries.unshift({type:"video_download"});
  }
  if (arr(note.note_text_press_options) &&
      !note.note_text_press_options.some(x => obj(x) && x.key === "copy"))
    note.note_text_press_options.push({key:"copy", extra:""});
  if (arr(note.hash_tag))
    note.hash_tag = note.hash_tag.filter(x => !obj(x) || x.type !== "interact_vote");
  if (arr(note.images_list)) note.images_list = note.images_list.map(image => {
    if (!obj(image) || typeof image.url !== "string") return image;
    image.url = image.url.replace(/imageView2\/2\/w\/\d+\/format/g, "imageView2/2/w/2160/format")
      .replace(/imageView2\/2\/h\/\d+\/format/g, "imageView2/2/h/2160/format");
    return image;
  });
  return note;
}
function route(path) { const m = url.match(/^[a-z]+:\/\/[^/?#]+(\/[^?#]*)/i); return m ? m[1] : ""; }

try {
  if (!original) throw new Error("empty response");
  const path = route(url);
  const data = JSON.parse(original);
  if (path.includes("/homefeed") || path.includes("/localfeed") || path.includes("/followfeed")) {
    if (arr(data.data)) data.data = filterNotes(data.data);
  } else if (path.includes("/note/videofeed") || path.includes("/note/feed")) {
    if (arr(data.data)) data.data = data.data.filter(x => !hasAd(x)).map(unlockNote);
  } else if (path.includes("/note/imagefeed")) {
    if (arr(data.data) && obj(data.data[0]) && arr(data.data[0].note_list))
      data.data[0].note_list = data.data[0].note_list.filter(x => !hasAd(x)).map(unlockNote);
  } else if (path.includes("/search/notes")) {
    if (obj(data.data) && arr(data.data.items))
      data.data.items = data.data.items.filter(x => obj(x) && x.model_type === "note" && !hasAd(x));
  } else if (path.includes("/search/banner_list")) {
    if (obj(data)) data.data = {};
  } else if (path.includes("/search/hot_list")) {
    if (obj(data.data)) data.data.items = [];
  } else if (path.includes("/search/hint")) {
    if (obj(data.data)) data.data.hint_words = [];
  } else if (path.includes("/search/trending")) {
    if (obj(data.data)) { data.data.queries = []; data.data.hint_word = {}; }
  } else if (path.includes("/system_service/config")) {
    if (obj(data.data)) ["loading_img","splash","store","home_banner","home_top_banner","my_banner","setting_banner"].forEach(k => delete data.data[k]);
  } else if (path.includes("/system_service/splash_config")) {
    if (obj(data.data)) { data.data.ads_groups = []; data.data.bidding_ads = []; }
  } else if (path.includes("/note/widgets")) {
    if (obj(data.data)) ["cooperate_binds","generic","note_next_step","widget_list","widget_summary","widgets_nbb","widgets_ncb","goods_card_comment_guide","goods_comment_section_card"].forEach(k => delete data.data[k]);
  } else if (path.includes("/recommend/user/follow_recommend")) {
    if (obj(data.data) && arr(data.data.rec_users)) data.data = {};
  } else if (path.includes("/note/comment/")) {
    const comments = obj(data.data) && arr(data.data.comments) ? data.data.comments : [];
    const fix = x => { if (!obj(x)) return; if (x.comment_type === 3) x.comment_type = 2; if (x.media_source_type === 1) x.media_source_type = 0; if (arr(x.sub_comments)) x.sub_comments.forEach(fix); };
    comments.forEach(fix);
  }
  body = JSON.stringify(data);
} catch (e) {
  console.log("小红书净化：解析失败，透传原响应");
}
$done({body});
