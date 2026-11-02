// 小红书 Loon 合并脚本：广告净化、下载解锁、去水印和画质增强。
// 解析失败时透传原响应，避免影响正常请求。
const url = ($request && $request.url) || "";
const original = $response.body;
let body = original;
const livePhotoCacheKey = "logic.xiaohongshu.livePhotos.v1";
const livePhotos = [];
const noteVideoCacheKey = "logic.xiaohongshu.noteVideos.v1";
const commentVideoCacheKey = "logic.xiaohongshu.commentVideos.v1";
const noteVideos = [];
const commentVideos = [];

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
function validLivePhoto(item) {
  return obj(item) && text(item.file_id) !== "" && text(item.video_id) !== "" && /^https?:\/\//i.test(text(item.url));
}
function readCache(key, valid) {
  try {
    if (typeof $persistentStore === "undefined") return [];
    const cached = JSON.parse($persistentStore.read(key) || "[]");
    return arr(cached) ? cached.filter(valid) : [];
  } catch (e) { return []; }
}
function bestStream(streams) {
  if (!obj(streams)) return null;
  for (const codec of ["h265", "h264"]) {
    const list = arr(streams[codec]) ? streams[codec] : [];
    const valid = list.filter(x => obj(x) && /^https?:\/\//i.test(text(x.master_url)));
    valid.sort((a, b) => ((Number(b.width) || 0) * (Number(b.height) || 0) -
      (Number(a.width) || 0) * (Number(a.height) || 0)) ||
      ((Number(b.avg_bitrate) || 0) - (Number(a.avg_bitrate) || 0)));
    if (valid.length) return valid[0];
  }
  return null;
}
function collectLivePhotos(images) {
  if (!arr(images)) return;
  images.forEach(image => {
    if (!obj(image) || !obj(image.live_photo) || !obj(image.live_photo.media)) return;
    const media = image.live_photo.media;
    const stream = bestStream(media.stream);
    const item = {file_id: image.live_photo_file_id, video_id: media.video_id, url: stream && stream.master_url};
    if (validLivePhoto(item)) livePhotos.push(item);
  });
}
function writeCache(key, items, idKey, valid) {
  if (!items.length || typeof $persistentStore === "undefined") return;
  // 每类保留最近 100 个文件，按稳定标识合并，避免跨笔记或分页串用地址。
  const seen = new Set();
  const cached = items.concat(readCache(key, valid)).filter(item => {
    if (!valid(item) || seen.has(item[idKey])) return false;
    seen.add(item[idKey]);
    return true;
  }).slice(0, 100);
  try { $persistentStore.write(JSON.stringify(cached), key); }
  catch (e) { /* 存储不可用时仍返回已解锁的笔记。 */ }
}
function replaceLivePhotoUrls(data) {
  if (!obj(data) || !arr(data.datas)) return;
  const cached = readCache(livePhotoCacheKey, validLivePhoto);
  data.datas.forEach(item => {
    if (!obj(item) || typeof item.url !== "string") return;
    const match = cached.find(x => x.file_id === item.file_id &&
      (!item.video_id || x.video_id === item.video_id));
    // 保留完整查询参数及原有元数据，不补造接口数据或成功状态。
    if (match) item.url = match.url;
  });
}
function validVideo(item) {
  return obj(item) && text(item.id) !== "" && /^https?:\/\//i.test(text(item.url));
}
function collectVideo(id, streams, target) {
  const stream = bestStream(streams);
  const item = {id, url: stream && stream.master_url};
  if (validVideo(item)) target.push(item);
}
function collectCommentVideos(comment) {
  for (const field of ["pictures", "videos"]) {
    if (!arr(comment[field])) continue;
    comment[field].forEach(item => {
      if (!obj(item) || typeof item.video_info !== "string") return;
      try {
        const info = JSON.parse(item.video_info);
        collectVideo(item.video_id, obj(info) && info.stream, commentVideos);
      } catch (e) { /* 单条媒体解析失败不影响其他评论。 */ }
    });
  }
}
function replaceNoteVideo(data) {
  if (!obj(data)) return;
  const match = readCache(noteVideoCacheKey, validVideo).find(x => x.id === data.note_id);
  if (!match) return;
  data.download_url = match.url;
  if (data.disable) {
    delete data.disable;
    delete data.msg;
    data.status = 2;
  }
}
function replaceCommentVideo(data) {
  if (!obj(data) || !obj(data.video)) return;
  const match = readCache(commentVideoCacheKey, validVideo).find(x => x.id === data.video.video_id);
  if (match) data.video.video_url = match.url;
}
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
  collectLivePhotos(note.images_list);
  if (obj(note.video_info_v2) && obj(note.video_info_v2.media))
    collectVideo(note.id, note.video_info_v2.media.stream, noteVideos);
  if (arr(note.images_list)) note.images_list = note.images_list.map(image => {
    if (!obj(image) || typeof image.url !== "string") return image;
    image.url = image.url.replace(/imageView2\/2\/w\/\d+\/format/g, "imageView2/2/w/2160/format")
      .replace(/imageView2\/2\/h\/\d+\/format/g, "imageView2/2/h/2160/format");
    return image;
  });
  return note;
}
// imagefeed/feed 可返回 data[].note_list；逐组处理，避免只修改外层或首组。
function unlockNotes(list) {
  if (!arr(list)) return list;
  return filterNotes(list).map(item => {
    if (obj(item) && arr(item.note_list)) item.note_list = unlockNotes(item.note_list);
    return unlockNote(item);
  });
}
function route(path) { const m = url.match(/^[a-z]+:\/\/[^/?#]+(\/[^?#]*)/i); return m ? m[1] : ""; }

try {
  if (!original) throw new Error("empty response");
  const path = route(url);
  const data = JSON.parse(original);
  if (path.includes("/homefeed") || path.includes("/localfeed") || path.includes("/followfeed")) {
    if (arr(data.data)) data.data = filterNotes(data.data);
    if (path.includes("/followfeed") && obj(data.data) && arr(data.data.items))
      data.data.items = filterNotes(data.data.items).filter(x => !obj(x) || x.recommend_reason !== "recommend_user");
  } else if (path.includes("/note/videofeed") || path.includes("/note/feed") || path.includes("/note/imagefeed")) {
    data.data = unlockNotes(data.data);
    writeCache(livePhotoCacheKey, livePhotos, "file_id", validLivePhoto);
    writeCache(noteVideoCacheKey, noteVideos, "id", validVideo);
  } else if (path.includes("/note/live_photo/save")) {
    replaceLivePhotoUrls(data.data);
  } else if (path.includes("/note/video/save")) {
    if (data.success !== false && (data.code === undefined || data.code === 0)) replaceNoteVideo(data.data);
  } else if (path.includes("/interaction/comment/video/download")) {
    if (data.success !== false && (data.code === undefined || data.code === 0)) replaceCommentVideo(data.data);
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
    if (obj(data.data)) ["loading_img","splash","store","home_banner","home_top_banner","my_banner","setting_banner","watermark_pic_path"].forEach(k => delete data.data[k]);
  } else if (path.includes("/system_service/splash_config")) {
    if (obj(data.data)) { data.data.ads_groups = []; data.data.bidding_ads = []; }
  } else if (path.includes("/note/widgets")) {
    if (obj(data.data)) ["cooperate_binds","generic","note_next_step","widget_list","widget_summary","widgets_nbb","widgets_ncb","goods_card_comment_guide","goods_comment_section_card"].forEach(k => delete data.data[k]);
  } else if (path.includes("/recommend/user/follow_recommend")) {
    if (obj(data.data) && arr(data.data.rec_users)) data.data = {};
  } else if (path.includes("/note/comment/")) {
    const comments = obj(data.data) && arr(data.data.comments) ? data.data.comments : [];
    const fix = x => {
      if (!obj(x)) return;
      if (x.comment_type === 3) x.comment_type = 2;
      if (x.media_source_type === 1) x.media_source_type = 0;
      collectCommentVideos(x);
      if (arr(x.sub_comments)) x.sub_comments.forEach(fix);
    };
    comments.forEach(fix);
    writeCache(commentVideoCacheKey, commentVideos, "id", validVideo);
  }
  body = JSON.stringify(data);
} catch (e) {
  console.log("小红书净化：解析失败，透传原响应");
}
$done({body});
