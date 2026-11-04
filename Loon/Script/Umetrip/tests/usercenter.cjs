const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../usercenter.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../../../umetrip.plugin'), 'utf8');
const ads = fs.readFileSync(path.join(__dirname, '../umetrip_ads.js'), 'utf8');
const urls = ['https://user.umetrip.com/weex/userCenter/userCenter.wume', 'https://static.umetrip.com/weex/userCenter/userCenter.wume?logic_uc=20261102-8', 'https://user.umetrip.com/weex/userCenter/pages/index/entry.js'];
const rules = [...plugin.matchAll(/^(?:request|response) if \$\{url\} ~= \/(.+)\/([ims]*) then script\(/gm)].map(r=>new RegExp(r[1], r[2]));
assert.equal(rules.length, 1, '必须读取到当前接口脚本规则，避免空列表误通过');
for (const url of urls) assert.ok(!rules.some(r=>r.test(url)), 'plugin must not intercept page resources');
function run(code, request, response) {
  const done=[];
  const context={Uint8Array,ArrayBuffer,$request:request,$done:r=>done.push(r)};
  if(response!==undefined)context.$response=response;
  vm.runInNewContext(code,context);
  assert.equal(done.length,1);
  return done[0];
}
for(const url of urls){
  const request={url,method:'GET',headers:{Range:'bytes=10-','If-None-Match':'original'}};
  const before=JSON.stringify(request);
  assert.equal(Object.keys(run(source,request)).length,0);
  const bytes=new Uint8Array([0,1,2,3]),response={body:bytes,headers:{ETag:'original','Content-Length':'4'}};
  assert.equal(Object.keys(run(source,request,response)).length,0);
  assert.equal(JSON.stringify(request),before);
  assert.equal(response.body,bytes);
  assert.equal(response.headers.ETag,'original');
}
if(process.argv[2]){
  const entries=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).log.entries;
  const oldResource=cp.execFileSync('git',['show','02e30e2:Loon/Script/Umetrip/usercenter.js'],{encoding:'utf8'});
  const oldContext={Uint8Array,ArrayBuffer,$request:{},$response:{},$done:()=>{},console};
  vm.createContext(oldContext);
  vm.runInContext(oldResource+';globalThis.zip=umetripZip;',oldContext);
  // 对照官方WXBridgeContext._pareJSBundleType：前100字符的首行头或use weex:vue指令。
  const recognizesVue=js=>{
    const head=js.trimStart().slice(0,100);
    return /^\/\/ \{ "framework": "[Vv]ue"/.test(head)||/use\s+weex:vue/i.test(head);
  };
  const packageEntry=entries.find(e=>new URL(e.request.url).pathname==='/weex/userCenter/userCenter.wume'&&e.response.content.text);
  assert.ok(packageEntry);
  const captured=oldContext.zip.strFromU8(oldContext.zip.unzipSync(Buffer.from(packageEntry.response.content.text,'base64'))['userCenter/pages/index/entry.js']);
  const original=captured.replace(/^\/\* Logic usercenter 20261102-(6|8) \*\//,'');
  assert.ok(recognizesVue(original),'original header selects Vue');
  assert.ok(!recognizesVue(oldContext.patchUsercenter(captured)),'withdrawn patch breaks native framework header detection');
  let resources=0,metadata=0;
  for(const e of entries){
    const url=new URL(e.request.url),rpid=e.request.headers.find(h=>h.name.toLowerCase()==='rpid')?.value;
    const request={...e.request,headers:Object.fromEntries(e.request.headers.map(h=>[h.name,h.value]))};
    const bytes=Buffer.from(e.response.content.text||'',e.response.content.encoding==='base64'?'base64':'utf8');
    const response={body:bytes,headers:Object.fromEntries(e.response.headers.map(h=>[h.name,h.value]))};
    if(url.pathname.startsWith('/weex/userCenter/')){
      assert.equal(Object.keys(run(source,request,response)).length,0);
      assert.equal(Object.keys(run(source,request)).length,0);
      resources++;
    }
    if(rpid==='1000015'){
      assert.equal(Object.keys(run(ads,request,response)).length,0,'resource metadata must remain unchanged');
      if(bytes.includes(Buffer.from('userCenter'))){
        const old=cp.execFileSync('git',['show','02e30e2:Loon/Script/Umetrip/umetrip_ads.js'],{encoding:'utf8'});
        assert.ok(run(old,request,response).body,'old version rewrites the resource metadata');
        metadata++;
      }
    }
  }
  assert.ok(resources&&metadata);
  console.log('HAR: '+resources+' resource requests/responses and '+metadata+' personal resource manifests remain unchanged; old metadata modification reproduced');
}
console.log('personal page rollback tests passed');
