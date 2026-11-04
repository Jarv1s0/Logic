# 闲鱼开屏广告拦截

- 插件：[Xianyu_remove_ads.lpx](../Xianyu_remove_ads.lpx)。
- [订阅直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/Xianyu_remove_ads.lpx)：添加至 Loon 的插件列表。要求 Loon 3.5.1(998) 或更高版本，启用插件、MitM，并安装及信任证书。
- 开屏接口：匹配 `acs.m.goofish.com`、`g-acs.m.goofish.com` 的 `mtop…splash.ads` 和 `mtop.idle.ad.expose` API，仅接受数字版本及完整路径边界，在请求发往上游前返回 HTTP 200 空文本。
- 素材补充：拦截 `video-zb.cloudvideocdn.taobao.com/mama_searchad_algo_upload/`，不屏蔽整个视频 CDN。该路径也可能用于闲鱼其他广告位或其他 App 的广告。

## 来源与验证边界

开屏与曝光接口参考 [ddgksf2013 小黄鱼净化规则](https://github.com/ddgksf2013/Rewrite/blob/master/AdBlock/GoofishAds.conf)（2026-11-04 读取，文件标注更新时间 2025-09-06）。本插件仅改写其中开屏相关 URL 的匹配与空响应行为，不包含其首页、搜索、我的页面过滤或 AMDC 脚本，不依赖远程脚本。

视频路径来自用户提供的 HAR：153 条请求中，同一广告视频有 10 次直接访问，另有 6 次视频入口请求通过 HTTP 302 指向它。路径包含 `mama_searchad_algo_upload`，但 HAR 无法证明该视频对应开屏还是其他广告位。HAR 未捕获上述开屏 API；接口当前版本的适用性无法从此抓包确认。HAR、账号、签名和设备标识不纳入仓库。

第二份 HAR 共 311 条请求，同样包含上述广告视频的 10 次直接访问，仍未捕获开屏 API。新增的 `ipm.atm.youku.com/ipm` 和 `bdlog.tanx.com/imp` 请求不能证明是开屏下发接口，不据此扩大屏蔽范围。两份 HAR 可能包含重复流量，不将其数量视为独立广告展示次数。

语法依据：[Loon 官方 Rewrite 文档](https://nsloon.app/docs/Rewrite/rewrite_v2)。使用 `response.body.mock("text", "", 200)`，保持参考规则的 HTTP 200 空响应语义，不虚构业务 JSON。已做 HAR URL 回放、正反例路径匹配和 MitM 域名覆盖检查；这些检查不能代替 Loon 解析器或真机验证。

尚未完成真机验证，无法保证开屏消失、倒计时跳过或广告占位折叠。启用后完全退出并重新启动闲鱼，检查开屏、登录、搜索、聊天和商品视频；可在 Loon 请求记录中确认规则命中。已有缓存可能继续展示，本插件不清理 App 本地缓存，也不要求卸载 App。
