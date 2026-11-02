const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../usercenter.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../../../umetrip.plugin'),'utf8');
const rules = [...plugin.matchAll(/^http-response (\S+) script-path=(\S+?),/gm)];
assert.ok(rules.some(r=>new RegExp(r[1]).test('https://user.umetrip.com/weex/userCenter/userCenter.wume')));
assert.ok(plugin.includes('hostname = user.umetrip.com,'));
for(const rule of rules)assert.ok(fs.existsSync(path.resolve(__dirname,'../../../..',new URL(rule[2]).pathname.replace('/Jarv1s0/Logic/master/',''))));
function context(body, url = 'https://user.umetrip.com/weex/userCenter/userCenter.wume', options = {}) {
  const done = [], logs = [];
  const state = { Uint8Array, ArrayBuffer, $request: { url }, $response: { body, headers: { 'Content-Length':'1', 'Content-Encoding':'gzip', ETag:'old', 'Content-Type':'application/octet-stream' } }, $done:r=>done.push(r), console:{log:s=>logs.push(s)} };
  Object.assign(state.$request, options.request);
  Object.assign(state.$response, options.response);
  if (options.requestOnly) delete state.$response;
  vm.createContext(state);
  vm.runInContext(source + '\nglobalThis.zip = umetripZip; globalThis.packageRecord = usercenterPackage;', state);
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
  const model = new Proxy({ _self:{_c:create}, $createElement:create, _e:()=>null, _v:x=>x, _s:String, _l:()=>[], isLogin:login, queryMyPageUserVipV4Response:{cached:true}, queryMyPageUserVipV5Response:{cached:true}, bannerList:[{cached:true}], memberTips:{children:[{title:'会员推广缓存'}]}, payData:{} }, { get:(target,key)=>target[key] });
  names.tree = render.call(model);
  return names;
}
const template = 'var example={render:function(){var t=this,e=t.$createElement,A=t._self._c||e;return A("div",{ref:"indexWrapper"},[' +
  components.map(name=>'A("'+name+'",{attrs:{cached:t.bannerList}})').join(',') + ',A("OrderStateCard"),A("UserPapersCard"),A("WalletCard",{attrs:{memberTips:t.memberTips}}),A("image",{staticClass:["hlLogo"],attrs:{src:"logo.png"}})])},staticRenderFns:[]}';
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
assert.equal(direct.result.headers['Content-Length'],String(direct.result.body.length));
assert.ok(!('Content-Encoding' in direct.result.headers));
assert.ok(!('ETag' in direct.result.headers));
assert.equal(direct.result.headers['Content-Type'],'application/octet-stream');
assert.equal(Object.keys(context(zip.strToU8(template),'https://example.com/entry.js').result).length,0);
for (const length of [0,1,55,56,63,64,65,1000,800000]) {
  const bytes = crypto.randomBytes(length);
  assert.equal(state.md5Bytes(bytes),crypto.createHash('md5').update(bytes).digest('hex'));
}
const requestResult=context(undefined,undefined,{requestOnly:true,request:{headers:{'If-None-Match':'old','If-Modified-Since':'old',Range:'bytes=100-','If-Range':'old',Accept:'application/octet-stream'}}}).result;
assert.deepEqual(Object.keys(requestResult.headers).sort(),['Accept','Cache-Control']);
assert.equal(requestResult.headers['Cache-Control'],'no-cache');
const head=context(undefined,undefined,{request:{method:'HEAD'},response:{headers:{ETag:state.packageRecord.etag,'Content-Length':'346784','Last-Modified':'old','Accept-Ranges':'bytes'}}}).result;
assert.equal(Number(head.headers['Content-Length']),state.packageRecord.size);
assert.ok(!('ETag' in head.headers));
assert.equal(Object.keys(context(undefined,undefined,{request:{method:'HEAD'}}).result).length,0);
assert.equal(Object.keys(context(zip.strToU8(template),undefined,{response:{status:206}}).result).length,0);
if(process.argv[2]) {
  const entries=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).log.entries;
  const e=entries.find(e=>new URL(e.request.url).pathname==='/weex/userCenter/userCenter.wume'&&e.response.content.text);
  assert.ok(e);
  const bytes=Buffer.from(e.response.content.text,'base64');
  const files=zip.unzipSync(bytes),key='userCenter/pages/index/entry.js';
  const original=zip.strFromU8(files[key]);
  const alreadyPatched=/\/\* Logic usercenter 20261102-(6|8) \*\//.test(original);
  const expected=alreadyPatched?state.patchUsercenter(original):verify(original);
  const {result,logs}=context(bytes,e.request.url);
  assert.ok(result.body,logs.join('\n'));
  const output=result.body||bytes;
  const rebuilt=zip.unzipSync(output);
  assert.deepEqual(Object.keys(rebuilt),Object.keys(files));
  for(const name of Object.keys(files))assert.deepEqual(Buffer.from(rebuilt[name]),name===key?Buffer.from(expected):Buffer.from(files[name]),name);
  const again=context(output,e.request.url).result;
  assert.ok(!again.body);
  assert.equal(Number(again.headers['Content-Length']),output.length);
  const outputMd5=crypto.createHash('md5').update(output).digest('hex');
  assert.equal(outputMd5,state.packageRecord.md5);
  assert.equal(output.length,state.packageRecord.size);
  const probes=entries.filter(x=>x.request.method==='HEAD'&&new URL(x.request.url).pathname==='/weex/userCenter/userCenter.wume');
  assert.ok(probes.length>0);
  for(const probe of probes){
    const response=context(undefined,probe.request.url,{request:{method:'HEAD'},response:{headers:Object.fromEntries(probe.response.headers.map(h=>[h.name,h.value]))}}).result;
    assert.equal(Number(response.headers['Content-Length']),output.length,'captured HEAD matches modified GET');
    assert.ok(!response.body);
  }
  assert.deepEqual(Buffer.from(context(bytes,e.request.url).result.body),Buffer.from(output),'deterministic ZIP bytes');
  assert.deepEqual(Buffer.from(context(bytes,e.request.url.replace('user.umetrip.com','static.umetrip.com')).result.body),Buffer.from(output),'configured static fallback');
  const changed=Object.assign({},files);
  changed['userCenter/images/arrow.png']=new Uint8Array([0,1,2]);
  assert.equal(Object.keys(context(zip.zipSync(changed),e.request.url).result).length,0,'unknown resource version retained');
  // 清单→下载→HEAD→实际render完整链路；使用独立Node MD5校验而非生产MD5函数作oracle。
  const ads=fs.readFileSync(path.join(__dirname,'../umetrip_ads.js'),'utf8');
  const oldResource=cp.execFileSync('git',['show','f2a786e:Loon/Script/Umetrip/usercenter.js'],{encoding:'utf8'});
  const oldOutput=[];
  vm.runInNewContext(oldResource,{Uint8Array,ArrayBuffer,$request:{url:e.request.url},$response:{body:bytes},console:{log:()=>{}},$done:r=>oldOutput.push(r)});
  const previousBytes=oldOutput[0].body||bytes;
  assert.notEqual(crypto.createHash('md5').update(previousBytes).digest('hex'),state.packageRecord.originalMd5,'old downloaded ZIP fails unchanged manifest checksum');
  assert.notEqual(previousBytes.length,346784,'old GET length disagrees with captured HEAD');
  let metadataCount=0;
  for(const entry of entries.filter(x=>x.request.headers.some(h=>h.name.toLowerCase()==='rpid'&&h.value==='1000015')&&Buffer.from(x.response.content.text||'','base64').includes(Buffer.from('userCenter')))) {
    const input=Buffer.from(entry.response.content.text,'base64'),done=[];
    const request={...entry.request,headers:Object.fromEntries(entry.request.headers.map(h=>[h.name,h.value]))};
    const sandbox={Uint8Array,ArrayBuffer,$request:request,$response:{body:input},$done:x=>done.push(x)};
    vm.createContext(sandbox);
    vm.runInContext(ads+';globalThis.read=fields;',sandbox);
    assert.equal(done.length,1);assert.ok(done[0].body);
    const record=b=>sandbox.read(sandbox.read(b).find(f=>f.number===7).value).find(f=>f.number===1).value;
    const before=sandbox.read(record(input)),after=sandbox.read(record(done[0].body));
    assert.equal(Buffer.from(after.find(f=>f.number===4).value).toString(),outputMd5);
    const downloadUrl=Buffer.from(after.find(f=>f.number===5).value).toString();
    assert.ok(downloadUrl.endsWith('?logic_uc=20261102-8'));
    for(let i=0;i<before.length;i++)if(![4,5].includes(before[i].number))assert.deepEqual(Buffer.from(after[i].raw),Buffer.from(before[i].raw));
    assert.deepEqual(Buffer.from(context(bytes,downloadUrl).result.body),Buffer.from(output));
    const old=cp.execFileSync('git',['show','f2a786e:Loon/Script/Umetrip/umetrip_ads.js'],{encoding:'utf8'});
    const oldDone=[];vm.runInNewContext(old,{Uint8Array,ArrayBuffer,$request:request,$response:{body:input},$done:r=>oldDone.push(r)});
    assert.equal(Object.keys(oldDone[0]).length,0,'old version leaves original checksum');
    assert.notEqual(outputMd5,Buffer.from(before.find(f=>f.number===4).value).toString());
    metadataCount++;
  }
  assert.ok(metadataCount>0);
  // 即使缓存数据仍包含广告，实际 render 也不再创建目标节点。
  for(const login of [1,2]) {
    const names=renderNames(expected,login);
    for(const name of [...components,'hlLogo'])assert.ok(!names.includes(name));
    if(login===2){
      const list=names.tree.children.find(n=>n?.name==='list');
      const cell=list.children.find(n=>n?.name==='cell');
      const bc=cell.children.find(n=>n?.props?.staticClass?.includes('bc'));
      assert.deepEqual(Array.from(bc.children.filter(Boolean),n=>n.name),['OrderStateCard','UserPapersCard','WalletCard']);
      const wallet=bc.children.find(n=>n?.name==='WalletCard');
      assert.equal(Object.keys(wallet.props.attrs.memberTips).length,0,'cached member tips not passed to wallet');
      const tipPosition=expected.indexOf('Object.keys(t.memberTips).length>0?A(');
      const walletStart=expected.lastIndexOf('render:function',tipPosition)+'render:'.length;
      const walletEnd=expected.indexOf('},staticRenderFns:',tipPosition)+1;
      const walletRender=vm.runInNewContext('('+expected.slice(walletStart,walletEnd)+')');
      const classes=[];
      const create=(name,props,children)=>{classes.push(...(props?.staticClass||[]));return {name,props,children};};
      const model={_self:{_c:create},$createElement:create,_e:()=>null,_v:x=>x,_s:String,_m:()=>null,_l:(list,fn)=>list.map(fn),walletInfoIcons:[{name:'我的余额',midStr:'0'}],walletIcon:{name:'我的钱包'},memberTips:{children:[{title:'缓存会员推广'}]}};
      walletRender.call(model);assert.ok(classes.includes('broow_content'),'old cached member tips reproduce banner');
      classes.length=0;walletRender.call({...model,memberTips:wallet.props.attrs.memberTips});
      assert.ok(!classes.includes('broow_content'),'wallet member banner and its container absent');
      assert.ok(classes.includes('cardList'),'wallet functions retained');
    }
  }
  console.log(`HAR: ${alreadyPatched?'upgrade existing patch':'patch original ZIP'}; ${metadataCount} manifests match ZIP MD5; GET/HEAD lengths agree; no lower promotional nodes or wrappers; upper services retained`);
}
console.log('usercenter tests passed');
