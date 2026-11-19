# Spotify 插件

适用于 Loon 3.5.1 (983) 及以上版本，入口为 [Spotify.lpx](../Spotify.lpx)。需启用 MitM 并信任证书。

## 配置模式

- 默认开启 `spot-ev3-enable`：按客户端版本选取预置配置；低于 9.1.76 使用旧快照，9.1.76 及以上使用新快照。无法识别版本时使用新快照。
- `spot-ev1-enable`：保留服务端配置，按规则修改广告、推广等配置项。
- 两种模式互斥，请只开启其中一种。两者统一调用 `spot-proto.js`，支持 `bootstrap`、`customize`、`remote-config-resolver/v数字/configuration` 和 `nebula/v数字/configuration/attributes`。
- 下载、音质及 Jam 相关的 12 项账号属性保留服务端原值；本插件不能证明或保证这些服务端能力可用。

新旧配置接口均清理请求中的 `if-none-match`。保留原有音频广告拦截及首页、搜索、播放页处理，艺人页的 iPad 布局修正扩展到专辑页。

历史 `spot-proto-eevee.js`、`spot-proto-ev3.js` 和 `Spotify.Crack.Dev.js` 保留，但不再由本插件调用。

## 来源

- 原有广告脚本：[devchristian1337/loon-plugins](https://github.com/devchristian1337/loon-plugins/tree/7ae0a25b2de75746dc602bfa890b9737d3847a9f)。
- 新接口、版本快照和配置规则：[Auto-001/QX---/spotify-qx.js](https://github.com/Auto-001/QX---/blob/main/spotify-qx.js)，上游同时署名 app2smile、devchristian1337。
- 本次取得的上游原始脚本 SHA-256：`25f7bb8f5600fd67552fc3ab5438bb9104aee85f4b978e1ffa76f5b5e2644083`。GitHub API 限流，未取得对应提交号；本仓库已内置快照及规则，运行时不请求上游脚本。
- 本仓库适配 Loon 二进制响应与模式参数，保留未知 Protobuf 字段，并为异常响应提供原样放行。

## 验证

在仓库根目录执行：

```powershell
node --check Loon/Script/Spotify/spot-proto.js
node --test Loon/Script/Spotify/tests/configuration.test.mjs
```

测试使用历史脚本内置的 protobufjs schema 作为独立编码、解码校验器，覆盖四类接口、配置响应的直接及封装结构、版本分界、两种模式、服务端属性保留、异常响应、二进制边界、未知字段和插件规则。

未完成 Spotify / Loon 真机验证。上游配置声称适配 9.1.98+，这不等于本仓库已经实测该版本。实际使用时需核对 Loon 日志中的接口、模式和处理结果，以及播放、切歌、首页和专辑页表现。未知结构或解析失败时返回原响应，不会用预置数据强行覆盖。
