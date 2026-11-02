const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../usercenter.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../../../umetrip.plugin'),'utf8');
const rules = [...plugin.matchAll(/^http-response (\S+) script-path=(\S+?),/gm)];
assert.ok(rules.some(r=>new RegExp(r[1]).test('https://user.umetrip.com/weex/userCenter/userCenter.wume')));
assert.ok(plugin.includes('hostname = user.umetrip.com,'));
for(const rule of rules)assert.ok(fs.existsSync(path.resolve(__dirname,'../../../..',new URL(rule[2]).pathname.replace('/Jarv1s0/Logic/master/',''))));
function context(body, url = 'https://user.umetrip.com/weex/userCenter/userCenter.wume') {
  const done = [], logs = [];
  const state = { Uint8Array, ArrayBuffer, $request: { url }, $response: { body, headers: { 'Content-Length':'1', 'Content-Encoding':'gzip', ETag:'old', 'Content-Type':'application/octet-stream' } }, $done:r=>done.push(r), console:{log:s=>logs.push(s)} };
  vm.createContext(state);
  vm.runInContext(source + '\nglobalThis.zip = umetripZip;', state);
  assert.equal(done.length, 1);
  return { state, result:done[0], logs };
}
const { state } = context();
const zip = state.zip;
const components = ['NewMemberCard','NewMemberCardQ3','Sliderbanner','GiftCenterCard','TravelServiceCard'];
const marker = 'render:function(){var t=this,e=t.$createElement,A=t._self._c||e;return A("div",{ref:"indexWrapper"';
const endMarker = '},staticRenderFns:[]}';
function renderNames(js, login = 2) {
  const start = js.indexOf(marker) + 'render:'.length;
  const end = js.indexOf(endMarker, start) + 1;
  const render = vm.runInNewContext('(' + js.slice(start,end) + ')');
  const names = [], create = (name, props, children) => { names.push(name === 'image' && props?.staticClass?.includes('hlLogo') ? 'hlLogo' : name); return {name,props,children}; };
  const model = new Proxy({ _self:{_c:create}, $createElement:create, _e:()=>null, _v:x=>x, _s:String, _l:()=>[], isLogin:login, queryMyPageUserVipV4Response:{cached:true}, queryMyPageUserVipV5Response:{cached:true}, bannerList:[{cached:true}], payData:{} }, { get:(target,key)=>target[key] });
  render.call(model);
  return names;
}
const template = 'var example={render:function(){var t=this,e=t.$createElement,A=t._self._c||e;return A("div",{ref:"indexWrapper"},[' +
  components.map(name=>'A("'+name+'",{attrs:{cached:t.bannerList}})').join(',') + ',A("OrderStateCard"),A("UserPapersCard"),A("WalletCard"),A("image",{staticClass:["hlLogo"],attrs:{src:"logo.png"}})])},staticRenderFns:[]}';
function verify(js) {
  const patched = state.patchUsercenter(js);
  new vm.Script(patched);
  assert.notEqual(patched,js);
  assert.equal(state.patchUsercenter(patched),patched);
  const before=renderNames(js),after=renderNames(patched);
  for(const name of [...components,'hlLogo']) { assert.ok(before.includes(name),name+' existed'); assert.ok(!after.includes(name),name+' removed'); }
  for(const name of ['OrderStateCard','UserPapersCard','WalletCard'])assert.ok(after.includes(name),name+' retained');
  return patched;
}
const patched = verify(template);
assert.throws(()=>state.patchUsercenter('unrecognized source'));
assert.throws(()=>state.patchUsercenter(template.replace('GiftCenterCard','UnknownCard')));
for(const body of [new Uint8Array([1,2,3]), undefined])assert.equal(Object.keys(context(body).result).length,0);
const direct = context(zip.strToU8(template),'https://user.umetrip.com/weex/userCenter/pages/index/entry.js');
assert.equal(zip.strFromU8(direct.result.body),patched);
assert.ok(!('Content-Length' in direct.result.headers));
assert.ok(!('Content-Encoding' in direct.result.headers));
assert.ok(!('ETag' in direct.result.headers));
assert.equal(direct.result.headers['Content-Type'],'application/octet-stream');
assert.equal(Object.keys(context(zip.strToU8(template),'https://example.com/entry.js').result).length,0);
if(process.argv[2]) {
  const entries=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).log.entries;
  const e=entries.find(e=>new URL(e.request.url).pathname==='/weex/userCenter/userCenter.wume'&&e.response.content.text);
  assert.ok(e);
  const bytes=Buffer.from(e.response.content.text,'base64');
  const files=zip.unzipSync(bytes),key='userCenter/pages/index/entry.js';
  const original=zip.strFromU8(files[key]);
  const expected=verify(original);
  const {result,logs}=context(bytes,e.request.url);
  assert.ok(result.body,logs.join('\n'));
  const rebuilt=zip.unzipSync(result.body);
  assert.deepEqual(Object.keys(rebuilt),Object.keys(files));
  for(const name of Object.keys(files))assert.deepEqual(Buffer.from(rebuilt[name]),name===key?Buffer.from(expected):Buffer.from(files[name]),name);
  assert.equal(Object.keys(context(result.body,e.request.url).result).length,0);
  // 即使缓存数据仍包含广告，实际 render 也不再创建目标节点。
  for(const login of [1,2]) {
    const names=renderNames(expected,login);
    for(const name of [...components,'hlLogo'])assert.ok(!names.includes(name));
  }
  console.log('HAR ZIP rebuilt: same entries, only entry.js content changed; real render hides 6 nodes and retains upper services');
}
console.log('usercenter tests passed');
