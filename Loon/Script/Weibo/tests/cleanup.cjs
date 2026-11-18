// node Loon/Script/Weibo/tests/cleanup.cjs [本地HAR路径] [旧提交]
// HAR 只在本地读取，不保存响应，不输出请求参数、账号或正文。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const [harPath, baseline] = process.argv.slice(2);
const source = baseline
  ? cp.execFileSync('git', ['show', `${baseline}:Loon/Script/Weibo/weibo_feed.js`], { encoding: 'utf8' })
  : fs.readFileSync(path.join(__dirname, '..', 'weibo_feed.js'), 'utf8');
let failures = 0;
function test(name, fn) {
  try { fn(); console.log('通过：' + name); }
  catch (error) { failures++; console.error('失败：' + name + '；' + error.message.split('\n')[0]); }
}
function replay(endpoint, data, stored = null) {
  let output, calls = 0;
  vm.runInNewContext(source, {
    $request: { url: 'https://api.weibo.cn/2/' + endpoint },
    $response: { body: JSON.stringify(data) },
    $persistentStore: { read: () => stored, write: () => { throw Error('不得写入配置'); } },
    $done: result => { calls++; output = JSON.parse(result.body); }, console: { log() {} }
  }, { timeout: 5000 });
  assert.equal(calls, 1);
  return output;
}
const promotions = ['ad_launch', 'ad', 'ad_red_packet', 'ad_vision_float_home', 'ad_vision_float',
  'red_pocket', 'find_red_packet', 'ug_high_priority', 'wb_custom_recommend'];
test('推广浮窗及强制展示列表同步清理，普通消息、直播和未知浮窗保留', () => {
  const floats = [...promotions, 'wb_msg', 'wb_msg_counter', 'wb_msg_subscribe', 'weibolive', 'future_window']
    .map(subtype => ({ type: 'native', subtype }));
  // 同名但未知的浮窗类型没有证据，必须保留。
  floats.push({ type: 'unknown', subtype: 'red_pocket' }, null);
  const input = { floating_windows: floats,
    floating_windows_force_show: ['ad_launch', 'ug_high_priority', 'wb_msg', 'future_window'],
    disable_floating_window: '0', floating_window_for_live_streaming: false, keep: { value: 1 } };
  const expected = { ...input, floating_windows: floats.slice(promotions.length),
    floating_windows_force_show: ['wb_msg', 'future_window'] };
  for (const endpoint of ['push/active', 'guest/push_active', 'push/daily', 'push/info']) {
    const output = replay(endpoint, input);
    assert.deepEqual(output, expected);
    assert.deepEqual(replay(endpoint, output), output);
  }
});
test('评论提示卡整张移除，保留排序、评论文字、未知卡片和分页', () => {
  const comment = { category: 'detail', type: 'comment', data: { text: '点击激活、话题投票是这条评论的文字' } };
  const filter = { category: 'detail', type: 'comment_header_filter', data: { title: '按热度' } };
  const unknown = { category: 'unknown', type: 'comment_header_tip', data: { content: '未知卡片' } };
  const input = { items: [
    { category: 'detail', type: 'comment_header_tip', data: { tip_type: 0, tip_msg: '提示', tip_state: 0 } },
    { category: 'detail', type: 'comment_header_tip', data: { tip_type: 3, tip_icon: 'icon.png' } },
    filter, comment, unknown
  ], pageData: { cursor: 'next' }, loadedInfo: { total_number: 20 } };
  for (const endpoint of ['statuses/container_detail', 'statuses/container_detail_comment',
    'statuses/container_detail_forward', 'comments/build_comments']) {
    const output = replay(endpoint, input);
    assert.deepEqual(output, { ...input, items: [filter, comment, unknown] });
    assert.deepEqual(replay(endpoint, output), output);
  }
  assert.deepEqual(replay('statuses/container_timeline', input), input);
});
const aiVote = { ai_vote_object_id: '1022:2317162026_example', generate_source: '1' };
test('本条、转发和详情扩展中的投票入口清理，正文及视频地址保留', () => {
  const summary = { video_oid: '1034:example' };
  const post = { text: '话题投票是正文的一部分', extend_info: { ai_vote_info: aiVote, video_summary: summary },
    retweeted_status: { text: '转发正文', extend_info: { ai_vote_info: aiVote, video_summary: summary } },
    page_info: { media_info: { vote_is_show: 1, stream_url: 'https://example.com/video.mp4' } } };
  const cleanPost = structuredClone(post);
  delete cleanPost.extend_info.ai_vote_info;
  delete cleanPost.retweeted_status.extend_info.ai_vote_info;
  cleanPost.page_info.media_info.vote_is_show = 0;
  for (const endpoint of ['statuses/container_timeline', 'statuses/container_timeline_hot',
    'statuses/container_timeline_unread', 'statuses/container_positive', 'guest/container_timeline_hot',
    'statuses/container_detail', 'profile/container_timeline', 'video/flow_stream', 'search/finder']) {
    const input = { items: [{ category: 'feed', data: post }], moreInfo: { cursor: 'next' } };
    assert.deepEqual(replay(endpoint, input), { ...input, items: [{ category: 'feed', data: cleanPost }] });
  }
  const detail = { detailInfo: { status: post, extend: { ai_vote_info: aiVote, comments_count: 3 } } };
  assert.deepEqual(replay('statuses/container_detail', detail),
    { detailInfo: { status: cleanPost, extend: { comments_count: 3 } } });
});
test('投票显示实验按原类型关闭，自动刷新关闭配置不阻断净化，发帖投票开关保留', () => {
  for (const enabled of [true, 'true', false, 'false', 'unknown']) {
    const disabled = enabled === true ? false : enabled === 'true' ? 'false' : enabled;
    const value = { p_feed_ai_vote_ios_enable: enabled, p_feed_ruibin_enable_ai_vote: enabled,
      p_vote_topic_guide_enable: enabled, p_ad_redPacket_enable: enabled,
      p_publisher_vote_enable: true, p_feed_home_auto_refresh_ea1: true };
    assert.deepEqual(replay('client/abserver_list', { value }, JSON.stringify({ homeAutoRefresh: null })),
      { value: { ...value, p_feed_ai_vote_ios_enable: disabled, p_feed_ruibin_enable_ai_vote: disabled,
        p_vote_topic_guide_enable: disabled, p_ad_redPacket_enable: disabled } });
  }
});
if (harPath) {
  const har = JSON.parse(fs.readFileSync(harPath, 'utf8').replace(/^\uFEFF/, ''));
  const decode = content => JSON.parse(content.encoding === 'base64'
    ? Buffer.from(content.text, 'base64').toString('utf8') : content.text);
  let tipCount = 0, floatCount = 0, voteCount = 0, flagCount = 0;
  test('真实 HAR 回放删除目标入口，保留评论、分页、消息浮窗及转发正文', () => {
    for (const entry of har.log.entries) {
      const url = new URL(entry.request.url);
      if (url.hostname !== 'api.weibo.cn') continue;
      const endpoint = url.pathname.replace(/^\/2\//, '');
      if (!['statuses/container_detail', 'statuses/container_detail_comment', 'statuses/container_timeline',
        'push/active', 'client/abserver_list'].includes(endpoint)) continue;
      const input = decode(entry.response._loonOriginal?.content || entry.response.content);
      const output = replay(endpoint, input);
      for (const key of ['pageData', 'moreInfo', 'refreshInfo']) assert.deepEqual(output[key], input[key]);
      if (endpoint === 'statuses/container_detail_comment') {
        tipCount += input.items.filter(item => item.type === 'comment_header_tip').length;
        assert.equal(output.items.some(item => item.type === 'comment_header_tip'), false);
        for (const type of ['comment', 'comment_header_filter']) {
          assert.deepEqual(output.items.filter(item => item.type === type), input.items.filter(item => item.type === type));
        }
      }
      if (endpoint === 'statuses/container_detail') {
        assert.equal(output.detailInfo.status.text, input.detailInfo.status.text);
        assert.deepEqual(output.detailInfo.status.user, input.detailInfo.status.user);
      }
      if (Array.isArray(input.floating_windows)) {
        const normal = input.floating_windows.filter(item => !promotions.includes(item.subtype));
        floatCount += input.floating_windows.length - normal.length;
        assert.deepEqual(output.floating_windows, normal);
        assert.ok(output.floating_windows_force_show.every(type => !promotions.includes(type)));
      }
      if (endpoint === 'client/abserver_list') {
        for (const key of ['p_feed_ai_vote_ios_enable', 'p_feed_ruibin_enable_ai_vote',
          'p_vote_topic_guide_enable', 'p_ad_redPacket_enable']) {
          if ([true, 'true'].includes(input.value?.[key])) {
            flagCount++;
            assert.ok([false, 'false'].includes(output.value[key]));
          }
        }
      }
      if (endpoint === 'statuses/container_timeline') {
        for (const item of input.items) {
          const quoted = item.data?.retweeted_status;
          if (!quoted?.extend_info?.ai_vote_info) continue;
          voteCount++;
          const kept = output.items.find(candidate => candidate.data?.idstr === item.data.idstr);
          assert.ok(kept, '投票所属微博必须保留');
          const expected = structuredClone(quoted);
          delete expected.extend_info.ai_vote_info;
          if (Array.isArray(expected.tag_struct)) expected.tag_struct = expected.tag_struct.filter(tag => tag.otype !== 'adFeedDarwinTag');
          assert.deepEqual(kept.data.retweeted_status, expected);
        }
      }
      assert.deepEqual(replay(endpoint, output), output);
    }
    assert.ok(tipCount > 0 && floatCount > 0 && voteCount > 0 && flagCount > 0, 'HAR 必须实际覆盖全部目标结构');
    console.log(`真实样本：${tipCount} 张评论提示卡、${floatCount} 个推广浮窗、${voteCount} 个投票入口、${flagCount} 个显示开关`);
  });
}
process.exitCode = failures ? 1 : 0;
