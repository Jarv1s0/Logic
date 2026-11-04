// 离线修复候选，不被插件引用，不修改下载资源或资源清单。
const fs=require('node:fs');
const cp=require('node:child_process');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const usercenterRenderStart = 'render:function(){var t=this,e=t.$createElement,A=t._self._c||e;return A("div",{ref:"indexWrapper"';
const usercenterRenderEnd = '},staticRenderFns:[]}';

function renderBounds(source) {
  const start = source.indexOf(usercenterRenderStart);
  if (start < 0 || source.indexOf(usercenterRenderStart, start + 1) >= 0) throw new Error('unknown personal page render');
  const end = source.indexOf(usercenterRenderEnd, start);
  if (end < 0) throw new Error('missing render end');
  return [start, end + usercenterRenderEnd.length];
}

// 定位已知创建节点调用，跳过字符串中的括号；未知模板不盲目替换。
function removeRenderCall(render, needle) {
  const start = render.indexOf(needle);
  if (start < 0 || render.indexOf(needle, start + 1) >= 0) throw new Error('unknown render node');
  let quote = '', depth = 0;
  for (let i = start + 1; i < render.length; i++) {
    const char = render[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') depth++;
    if (char === ')' && --depth === 0) return render.slice(0, start) + 't._e()' + render.slice(i + 1);
  }
  throw new Error('unclosed render call');
}

function patchUsercenter(source) {
  const marker = '/* Logic usercenter candidate-header-safe */';
  if (source.includes(marker)) return source;
  const previous = source.includes('/* Logic usercenter 20261102-6 */');
  source = source.replace('/* Logic usercenter 20261102-6 */', '');
  const [start, end] = renderBounds(source);
  let render = source.slice(start, end);
  if (!previous) {
    for (const component of ['NewMemberCard', 'NewMemberCardQ3', 'Sliderbanner', 'GiftCenterCard', 'TravelServiceCard']) {
      render = removeRenderCall(render, 'A("' + component + '",');
    }
    render = removeRenderCall(render, 'A("image",{staticClass:["hlLogo"]');
  }
  const walletTips = 'memberTips:t.memberTips';
  if (render.split(walletTips).length !== 2) throw new Error('unknown wallet member tips');
  render = render.replace(walletTips, 'memberTips:{}');
  return source.slice(0, start) + render + source.slice(end) + '\n' + marker;
}


const historical=cp.execFileSync('git',['show','02e30e2:Loon/Script/Umetrip/usercenter.js'],{encoding:'utf8'});
const sandbox={Uint8Array,ArrayBuffer,$request:{},$response:{},$done:()=>{},console};
vm.createContext(sandbox);
vm.runInContext(historical+';globalThis.zip=umetripZip;',sandbox);
const entries=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).log.entries;
const resource=entries.find(e=>new URL(e.request.url).pathname==='/weex/userCenter/userCenter.wume'&&e.response.content.text);
assert.ok(resource);
const archive=sandbox.zip.unzipSync(Buffer.from(resource.response.content.text,'base64'));
const captured=sandbox.zip.strFromU8(archive['userCenter/pages/index/entry.js']);
const original=captured.replace(/^\/\* Logic usercenter 20261102-(6|8) \*\//,'');
const patched=patchUsercenter(captured);
assert.equal(patched.slice(0,100),original.slice(0,100),'native framework declaration preserved byte for byte');
new vm.Script(patched);
assert.equal(patchUsercenter(patched),patched);
const start=patched.indexOf(usercenterRenderStart)+'render:'.length;
const end=patched.indexOf(usercenterRenderEnd,start)+1;
const render=vm.runInNewContext('('+patched.slice(start,end)+')');
const create=(name,props,children)=>({name,props,children});
const model={_self:{_c:create},$createElement:create,_e:()=>null,_v:x=>x,_s:String,_l:()=>[],isLogin:2,queryMyPageUserVipV4Response:{cached:true},queryMyPageUserVipV5Response:{cached:true},bannerList:[{cached:true}],memberTips:{children:[{title:'会员缓存'}]},payData:{}};
const tree=render.call(model);
const list=tree.children.find(n=>n?.name==='list');
const cell=list.children.find(n=>n?.name==='cell');
const content=cell.children.find(n=>n?.props?.staticClass?.includes('bc'));
assert.deepEqual(Array.from(content.children.filter(Boolean),n=>n.name),['OrderStateCard','UserPapersCard','WalletCard']);
assert.equal(Object.keys(content.children.find(n=>n?.name==='WalletCard').props.attrs.memberTips).length,0);
console.log('Offline candidate: original first 100 bytes intact; full JavaScript syntax valid; no promotional components or lower wrappers; wallet retained. Native startup and installation NOT verified.');

if(process.argv[3]){
  global.WXEnvironment={platform:'iOS'};
  const path=require('node:path');
  const runtime=require(path.join(process.argv[3],'weex-js-runtime'));
  const framework=require(path.join(process.argv[3],'weex-vue-framework'));
  function boot(js,id){
    const calls=[],errors=[];
    const document=new runtime.config.Document(id,'https://user.umetrip.com/weex/userCenter/pages/index/entry.js',(...args)=>calls.push(args));
    document.taskCenter.send=(...args)=>{calls.push(args);};
    document.documentElement.appendChild(document.createBody('div'));
    const modules=new Map();
    const weex={document,config:{bundleUrl:document.URL,env:{platform:'iOS',osName:'iOS',deviceWidth:750,deviceHeight:1624,appVersion:'8.0.0',weexVersion:'0.28',userAgent:'iOS'}},supports:x=>x.startsWith('@component/'),requireModule:name=>{
      if(!modules.has(name))modules.set(name,new Proxy({}, {get:(_,method)=>(...args)=>{calls.push([name,method,args]);}}));
      return modules.get(name);
    }};
    const instance=framework.createInstanceContext(id,{weex});
    instance.Vue.config.errorHandler=e=>errors.push(String(e));
    instance.Vue.config.silent=true;
    const globals={...instance,weex,console:{log:()=>{},warn:()=>{},error:(...s)=>errors.push(s.join(' '))},WXEnvironment:weex.config.env,callNative:()=>{},__register_static_styles__:()=>{}};
    try {vm.runInNewContext(js,globals,{timeout:15000});}catch(e){errors.push(e.stack);}
    return {calls,errors,body:document.body};
  }
  const before=boot(original,'original'),after=boot(patched,'candidate');
  console.log('Full runtime original errors:',before.errors);
  console.log('Full runtime candidate errors:',after.errors);
  assert.deepEqual(after.errors,before.errors,'candidate must not introduce startup errors');
  assert.equal(before.errors.length,0,'baseline runtime must actually boot');
  assert.ok(before.body&&after.body,'native virtual document created');
  console.log('Full Weex Vue runtime: original and candidate both boot with no reported JavaScript errors. Native modules are stubs; no device claim.');
}
