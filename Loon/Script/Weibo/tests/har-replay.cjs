// 只读本地 HAR，重放 Loon 改写前的真实响应；不输出请求参数或正文。
// node Loon/Script/Weibo/tests/har-replay.cjs <HAR路径> [旧提交]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const vm = require('node:vm');
const [harPath, baseline] = process.argv.slice(2);
assert.ok(harPath, '必须提供本地 HAR 路径');
const har = JSON.parse(fs.readFileSync(harPath, 'utf8').replace(/^\uFEFF/, ''));
const source = baseline
  ? cp.execFileSync('git', ['show', `${baseline}:Loon/Script/Weibo/weibo_ads.js`], { encoding: 'utf8' })
  : fs.readFileSync(path.join(__dirname, '..', 'weibo_ads.js'), 'utf8');
function decode(content) {
  assert.ok(content?.text, 'HAR 必须包含响应正文');
  return JSON.parse(content.encoding === 'base64'
    ? Buffer.from(content.text, 'base64').toString('utf8') : content.text);
}
function replay(url, data) {
  let output;
  const errors = [];
  vm.runInNewContext(source, {
    $request: { url }, $response: { body: JSON.stringify(data) },
    $done: (result) => { output = JSON.parse(result.body); },
    console: { log: (line) => {
      if (typeof line === 'string' && line.includes('脚本运行出现错误')) errors.push(line);
    } }
  });
  assert.equal(errors.length, 0, '处理真实响应不能中途报错');
  return output;
}
let count = 0;
let failures = 0;
for (const entry of har.log.entries) {
  if (new URL(entry.request.url).pathname !== '/2/search/finder') continue;
  count++;
  try {
    const original = decode(entry.response._loonOriginal?.content);
    const recorded = decode(entry.response.content);
    const output = replay(entry.request.url, original);
    const channels = original.channelInfo.channels;
    assert.ok(channels.length > 0, '真实原始响应必须有频道');
    assert.ok(channels.every((channel) => channel.id === undefined), '该回归验证针对缺少 id 的新版频道');
    if (baseline) {
      assert.deepEqual(output, recorded, '旧提交重放应复现 HAR 的实际改写结果');
    }
    assert.equal(output.channelInfo.channels.length, channels.length, '不能清空新版发现频道');
    for (let i = 0; i < channels.length; i++) {
      const before = channels[i];
      const after = output.channelInfo.channels[i];
      assert.equal(after.key, before.key);
      assert.equal(after.pageId, before.pageId);
      assert.equal(after.apiPath, before.apiPath);
      if (!before.payload) {
        assert.deepEqual(after, before);
        continue;
      }
      const feeds = before.payload.items.filter((item) => item.category === 'feed');
      assert.ok(feeds.length > 0, '原始发现流必须包含微博');
      // 两条真实响应均含 ad_state=1 的广告；其余微博逐字保留。
      const ads = feeds.filter((item) => item.data?.ad_state === 1);
      assert.ok(ads.length > 0, '真实样本必须同时覆盖广告过滤和正常内容保留');
      const normalFeeds = feeds.filter((item) => item.data?.ad_state !== 1);
      assert.deepEqual(after.payload.items.filter((item) => item.category === 'feed'), normalFeeds);
      console.log(`真实微博：${feeds.length} 条，保留 ${normalFeeds.length} 条，删除 ${ads.length} 条明确广告`);
      assert.deepEqual(after.payload.moreInfo, before.payload.moreInfo);
      assert.deepEqual(after.payload.refreshInfo, before.payload.refreshInfo);
      assert.deepEqual(after.payload.pageData, before.payload.pageData);
    }
    function checkHotSearch(before, after) {
      assert.ok(Array.isArray(after), '顶部模块必须保留');
      for (const item of before || []) {
        const type = Number(item?.data?.card_type);
        if ([17, 235].includes(type)) {
          const kept = after.find((candidate) => Number(candidate?.data?.card_type) === type);
          assert.ok(kept, '不能删除整个热搜列表');
          const groups = type === 17 ? [item.data] : item.data.channel_list;
          const keptGroups = type === 17 ? [kept.data] : kept.data.channel_list;
          assert.equal(keptGroups.length, groups.length, '热搜频道必须保留');
          groups.forEach((group, index) => {
            const normal = group.group.filter((entry) => !entry.itemid?.includes('is_ad_pos')
              && !entry.itemid?.includes('city_code') && !entry.promotion);
            assert.deepEqual(keptGroups[index].group, normal, '正常热搜必须逐字保留');
            console.log(`真实热搜：${group.group.length} 条，保留 ${normal.length} 条`);
          });
        }
        if (Array.isArray(item?.items)) {
          const kept = after.find((candidate) => candidate.itemId === item.itemId && Array.isArray(candidate.items));
          assert.ok(kept, '热搜所在分组必须保留');
          checkHotSearch(item.items, kept.items);
        }
      }
    }
    if (original.header?.data?.items) {
      checkHotSearch(original.header.data.items, output.header?.data?.items);
    }
    assert.deepEqual(replay(entry.request.url, output), output, '重复执行不能继续删除内容');
    console.log(`通过：真实发现响应 ${count}，保留 ${channels.length} 个频道及正常微博、分页字段`);
  } catch (error) {
    failures++;
    console.error(`失败：真实发现响应 ${count}，${error.message.split('\n')[0]}`);
  }
}
assert.ok(count > 0, 'HAR 未包含发现接口');
process.exitCode = failures ? 1 : 0;
