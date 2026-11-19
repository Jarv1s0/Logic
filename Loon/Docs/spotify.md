# Spotify 插件

适配范围：Spotify 9.1.98+，Loon 3.5.1 (983) 及以上版本；未完成真机验证。入口为 [Spotify.lpx](../Spotify.lpx)，需启用 MitM 并信任证书。

## 自动适配

- 启用插件后统一使用当前预置配置，无需选择模式；不再维护旧版本快照或版本切换逻辑。
- 配置接口统一调用 `spot-proto.js`，支持 `bootstrap`、`customize`、`remote-config-resolver/v数字/configuration` 和 `nebula/v数字/configuration/attributes`。
- 下载、音质及 Jam 相关的 12 项账号属性保留服务端原值；本插件不能证明或保证这些服务端能力可用。

新旧配置接口均清理请求中的 `if-none-match`。保留原有音频广告拦截及首页、搜索、播放页处理，艺人页的 iPad 布局修正扩展到专辑页。

历史 `spot-proto-eevee.js`、`spot-proto-ev3.js` 和 `Spotify.Crack.Dev.js` 保留，但不再由本插件调用。

## 来源

- 原有广告脚本：[devchristian1337/loon-plugins](https://github.com/devchristian1337/loon-plugins/tree/7ae0a25b2de75746dc602bfa890b9737d3847a9f)。
- 新接口、版本快照和配置规则：[Auto-001/QX---/spotify-qx.js](https://github.com/Auto-001/QX---/blob/main/spotify-qx.js)，上游同时署名 app2smile、devchristian1337。
- 本次取得的上游原始脚本 SHA-256：`25f7bb8f5600fd67552fc3ab5438bb9104aee85f4b978e1ffa76f5b5e2644083`。GitHub API 限流，未取得对应提交号；本仓库已内置快照及规则，运行时不请求上游脚本。
- 本仓库适配 Loon 二进制响应，保留未知 Protobuf 字段，并为异常响应提供原样放行。

## 验证

在仓库根目录执行：

```powershell
node --check Loon/Script/Spotify/spot-proto.js
node --test Loon/Script/Spotify/tests/configuration.test.mjs
```

测试使用历史脚本内置的 protobufjs schema 作为独立编码、解码校验器，覆盖四类接口、配置响应的直接及封装结构、固定预置配置、服务端属性保留、异常响应、二进制边界、未知字段和插件规则。

适配范围依据上游声明，不能保证后续所有版本均有效。实际使用时需核对 Loon 日志中的接口和处理结果，以及播放、切歌、首页和专辑页表现。未知结构或解析失败时返回原响应，不会用预置数据强行覆盖。
