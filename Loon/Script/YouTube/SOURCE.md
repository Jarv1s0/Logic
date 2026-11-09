# 来源与构建

运行入口为本目录的九个分接口脚本。源码保存在 `src/`，不要直接编辑新生成的 `*.min.js`。

## 合并边界

- `src/legacy/`：从本仓库原先收录的 devchristian1337 请求与响应脚本提取处理函数，格式化为模块；保留播放广告、后台播放、地区参数、首页 Shorts、频道屏蔽、配置缓存及日志处理。
- `src/vendor/`：收录 Horatio Xu 的 YouTube Clean 1.2.12 广告模板、新首页容器、底栏、字幕与协议编辑源码，固定提交为 `53e4351e1cbd892803554b698ef3e5fe46767d9a`，原目录为 `Surge/script/YouTubeClean/src/`。
- `src/api.mjs` 与 `src/entries/`：本仓库适配。信息流先运行新增广告与底栏处理，再运行原信息流处理；每次宿主执行只调用一次 `$done`。播放封装仍沿用原插件的处理方式，没有接入对方的 UMP 解密运行时。
- 现有 `request.min.js`、`response.min.js` 保持原样，供缓存旧配置的客户端及本地兼容性对照使用；新版插件不再引用这两个入口。

原收录脚本的 SHA-256：

```text
request.min.js   4e398c4aa063b91c54e8bff723379fc0923d6eef3ae45bbece49d469857cb16b
response.min.js  f7b40172c0ad3a53a7f61241e4516fdc6d27c83432f655dbc6ed0d4a4cb5f3eb
```

`vendor.json` 记录对方提交中原始源码的 SHA-256。本地对 `data.mjs` 仅扩展字幕主机匹配，使原插件已支持的 `youtube.com` 无子域名地址继续有效。上游测试夹具与字幕排版、时间轴、协议编辑测试已选取收录；排版测试改为直接调用字幕模块，不加载对方播放运行时。另有针对本仓库实际分接口产物与插件配置的整合测试。

## 构建与验证

需要 Node.js 与 npm，在本目录执行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

只重新生成脚本时执行 `npm run build`。构建无远程源码加载；`fflate` 提供有上限的 gzip 解压，`esbuild` 为构建工具，`protobufjs` 仅用于独立生成和检查测试数据。客户端运行时不需要安装这些工具。

入口按信息流、信息流请求、播放请求、播放响应、配置请求、配置响应、日志、频道更新与字幕拆分。`build-manifest.json` 记录各产物的字节数、SHA-256 和实际包含的源码模块；字幕不包含首页协议图，播放响应不包含字幕、首页过滤或日志页面模块。脚本体积变化不能证明 Loon 真机内存或延迟改善。

## 许可

devchristian1337 的上游 README 标注 MIT License，原仓库未提供独立的 `LICENSE` 或 `LICENSE.md` 文件；保留原作者与来源，不补造版权条款。

Horatio Xu 及其协议图、广告模板事实参考和通用库的原始许可与声明收录在 `licenses/`，并嵌入新生成脚本头部。`YouTubeClean-NOTICE.txt` 描述其原项目，合并范围以本文件为准。

- [原播放与信息流插件来源](https://github.com/devchristian1337/loon-plugins)
- [YouTube Clean 固定版本源码](https://github.com/hhhoratioxu/Proxy/tree/53e4351e1cbd892803554b698ef3e5fe46767d9a/Surge/script/YouTubeClean)

更新插件时仍须按仓库规则读取实际时钟，将 `#!date` 写为北京时间，精确到秒。
