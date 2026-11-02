const fs = require('node:fs');
const path = require('node:path');
// 保留旧脚本地址供旧配置更新；不得重新分发已撤回的资源改写。
const patch = fs.readFileSync(path.join(__dirname, 'usercenter.patch.js'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'usercenter.js'), patch);
