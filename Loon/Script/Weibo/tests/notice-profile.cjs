// node Loon/Script/Weibo/tests/notice-profile.cjs [本地HAR路径] [--baseline]
// 不保存 HAR 内容，不输出账号、请求参数或正文。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const args = process.argv.slice(2);
const harPath = args.find(arg => arg !== '--baseline');
const source = args.includes('--baseline')
  ? cp.execFileSync('git', ['show', 'HEAD:Loon/Script/Weibo/weibo_feed.js'], { encoding: 'utf8' })
  : fs.readFileSync(path.join(__dirname, '..', 'weibo_feed.js'), 'utf8');
let failures = 0;
function test(name, fn) {
  try { fn(); console.log('通过：' + name); }
  catch (error) { failures++; console.error('失败：' + name + '；' + error.message.split('\n')[0]); }
}
function replay(endpoint, input) {
  let output, calls = 0;
  vm.runInNewContext(source, {
    $request: { url: 'https://api.weibo.cn/2/' + endpoint },
    $response: { body: JSON.stringify(input) },
    $persistentStore: { read: () => null, write: () => { throw Error('不得写入配置'); } },
    $done: result => { output = JSON.parse(result.body); calls++; }, console: { log() {} }
  }, { timeout: 5000 });
  assert.equal(calls, 1);
  return output;
}
test('消息动态移除粉丝头条及有广告来源的卡片，保留普通动态与分页', () => {
  const normal = { type: 57, msg_card: { content: '粉丝头条是正文', ad_tag: { text: '是 TA 的铁粉' } } };
  const unknown = { type: 47, msg_card: { ad_tag: { text: '未知' } } };
  const input = { messages: [normal, unknown,
    { type: 47, msg_card: { ad_tag: { text: '粉丝头条' } } },
    { type: 47, msg_card: { actionlog: { source: 'ad' } } },
    { type: 47, msg_card: { ad_tag: { text: '荐读' } } }
  ], next_cursor: 'next', total_number: 5 };
  const output = replay('messageflow/notice', input);
  assert.deepEqual(output, { ...input, messages: [normal, unknown] });
  assert.deepEqual(replay('messageflow/notice', output), output);
});
test('个人页仅清除头部会员广告视图，保留会员标识、用户资料与普通会员视图', () => {
  const header = { category: 'mine', type: 'header', itemId: 'profileme_mine_head',
    username: { content: '正常用户' }, vipIcon: { type: 'icon' },
    vipView: { itemId: 'vipcenter_out_340_adsystem', content: '会员限时特惠' } };
  const normalHeader = { ...header, vipView: { itemId: 'vip_status', content: '会员状态' } };
  const input = { items: [{ category: 'group', itemId: 'profileme_mine', header, items: [] },
    { category: 'group', header: normalHeader, items: [] }], moreInfo: { cursor: 'next' } };
  const expected = structuredClone(input);
  delete expected.items[0].header.vipView;
  for (const endpoint of ['profile/me', 'profile/container_timeline']) {
    const output = replay(endpoint, input);
    assert.deepEqual(output, expected);
    assert.deepEqual(replay(endpoint, output), output);
  }
});
if (harPath) test('真实 HAR：动态粉丝头条、双十一广告及个人页会员推广清理，正常内容保留', () => {
  const har = JSON.parse(fs.readFileSync(harPath, 'utf8').replace(/^\uFEFF/, ''));
  let fanCount = 0, vipCount = 0, doubleCount = 0, normalCount = 0;
  for (const entry of har.log.entries) {
    const url = new URL(entry.request.url);
    if (url.hostname !== 'api.weibo.cn') continue;
    const endpoint = url.pathname.replace(/^\/2\//, '');
    if (!['messageflow/notice', 'profile/me'].includes(endpoint)) continue;
    const content = entry.response._loonOriginal?.content || entry.response.content;
    const input = JSON.parse(content.encoding === 'base64'
      ? Buffer.from(content.text, 'base64').toString('utf8') : content.text);
    const output = replay(endpoint, input);
    if (endpoint === 'messageflow/notice') {
      const normal = input.messages.filter(message => Number(message.type) !== 47);
      assert.deepEqual(output.messages.filter(message => Number(message.type) !== 47), normal);
      normalCount += normal.length;
      for (const message of input.messages) {
        const card = message.msg_card;
        if (Number(message.type) !== 47) continue;
        if (card?.ad_tag?.text === '粉丝头条') {
          fanCount++;
          assert.equal(output.messages.some(item => item.id === message.id), false);
        }
        const icons = card?.title?.main_user?.icons;
        if (Array.isArray(icons) && icons.some(icon =>
          typeof icon.scheme === 'string' && /\/activity\/double202611\//.test(icon.scheme))) {
          doubleCount++;
          assert.equal(output.messages.some(item => item.id === message.id), false);
        }
      }
      const expected = structuredClone(input);
      expected.messages = input.messages.filter(message => Number(message.type) !== 47
        || (!['广告', '廣告', '荐读', '粉丝头条'].includes(message.msg_card?.ad_tag?.text)
          && message.msg_card?.actionlog?.source !== 'ad'));
      assert.deepEqual(output, expected);
    } else {
      const before = input.items.find(item => item.itemId === 'profileme_mine');
      if (!before) continue;
      const after = output.items.find(item => item.itemId === 'profileme_mine');
      assert.ok(after);
      const expected = structuredClone(before);
      if (/^vipcenter_out_\d+_adsystem$/.test(expected.header?.vipView?.itemId)) {
        vipCount++;
        delete expected.header.vipView;
      }
      assert.deepEqual(after, expected, '资料头部与微博/关注/粉丝计数必须保留');
      for (const key of ['mineinfo', 'moreInfo', 'pageData', 'config']) assert.deepEqual(output[key], input[key]);
      assert.equal(output.items.some(item => item.category === 'card' && Number(item.data?.card_type) === 236), false);
    }
    assert.deepEqual(replay(endpoint, output), output);
  }
  assert.ok(fanCount > 0 && vipCount > 0 && doubleCount > 0 && normalCount > 0, 'HAR 必须实际覆盖每类目标及正常动态');
  console.log(`真实样本：${fanCount} 张粉丝头条、${vipCount} 个会员广告视图、${doubleCount} 张含双十一入口的广告；保留 ${normalCount} 条普通动态`);
});
process.exitCode = failures ? 1 : 0;
