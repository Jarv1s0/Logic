# 闲鱼广告净化

- 插件：[Xianyu_remove_ads.lpx](../Xianyu_remove_ads.lpx)。
- [订阅直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/Xianyu_remove_ads.lpx)：添加至 Loon 的插件列表。要求 Loon 3.5.1(998) 或更高版本，启用插件、MitM，并安装及信任证书。
- 开屏接口：匹配 `acs.m.goofish.com`、`g-acs.m.goofish.com` 的 `mtop…splash.ads` 和 `mtop.idle.ad.expose` API，仅接受数字版本及完整路径边界，在请求发往上游前返回 HTTP 200 空文本。
- 素材补充：拦截 `video-zb.cloudvideocdn.taobao.com` 和 `video-sh.cloudvideocdn.taobao.com` 的 `/mama_searchad_algo_upload/`，不屏蔽整个视频 CDN。该路径也可能用于闲鱼其他广告位或其他 App 的广告。
- 跟踪补充：拦截 `df.tanx.com/spf3` 并返回 HTTP 200 空文本，阻止抓包中重复出现的跟踪像素请求；这项不能独立移除广告卡片，也可能影响其他 App 使用同一端点的统计。

## 页面过滤

插件加载本仓库的 [xianyu.js](../Script/Xianyu/xianyu.js)，只处理 HTTP 200、`ret` 全部为 `SUCCESS::` 的 JSON 响应。接口均限定上述两个 goofish 域名、完整 API 名和数字版本。

- 首页 `mtop.taobao.idlehome.home.nextfresh`：从 `data.sections` 删除 `data.bizType` 为 `AD` 或 `mamaAD` 的卡片，保留正常商品、未知类型、顶部入口和横幅。
- 首页悬浮入口 `mtop.taobao.idle.user.strategy.list`：清空数组类型的 `data.strategies`，参考规则将该接口标注为首页右下角悬浮球；会一并移除该数组中的其他策略入口。
- 首页 Tab `mtop.taobao.idlehome.home.circle.list`：仅从 `data.circleList` 删除 `bizCode=saveMoney` 的省钱入口，保留其他 Tab。
- 搜索结果 `mtop.taobao.idlemtopsearch.search`：删除 `data.item.main.exContent.isAliMaMaAD` 为布尔值 `true` 或字符串 `"true"` 的结果，也删除同一卡片 `clickParam.args.biz_type` 为 `AD` 或 `mamaAD` 的结果；保留正常结果、筛选模块和未知结构。
- 搜索页推广：`mtop.taobao.idlemtopsearch.search.shade` 清空数组类型的 `data.singleShadeWords`（预填词）；`mtop.taobao.idlemtopsearch.item.search.activate` 清空数组类型的 `data.cardList`（“猜你可能找”）；`mtop.taobao.idlemtopsearch.search.discover` 删除数组类型的 `data.resultList`（搜索发现）。这些推荐区包含普通内容，会整体移除，不只是广告条目。
- 本地信息流 `mtop.taobao.idle.local.home`：按首页同样的广告类型标记过滤 `data.sections`，保留正常商品和未知模块。
- 商品详情推荐 `mtop.taobao.idle.item.recommend` 及 `.list`：仅从 `data.cardList` 删除 `cardData.bizType` 为 `AD` 或 `mamaAD` 的卡片，不修改商品详情正文、价格或交易接口。
- “我的”页面 `mtop.idle.user.page.my.adapter`：清空数组类型的底部推荐 `data.ability`（含普通推荐），从 `data.container.sections` 删除明确带上述广告类型的卡片。保留未标记的账户、订单、工具、回收及菜单模块，不按索引批量删除。
- “我的”页面商品流 `mtop.taobao.idle.item.buy.feeds`：数组类型的 `data.sections` 整体删除，移除其中全部推荐商品（包含普通推荐），保留其他字段。此项按照用户要求去掉“猜你喜欢”，不局限于带广告标记的商品；该接口是否对应当前 App 的“猜你喜欢”仍未得到真实抓包验证。

解析失败、业务错误、未知结构和没有命中过滤目标的响应保持原文；不递归删除任意名称含 `ad` 的字段。不覆盖其他无标记的推广、详情内其他广告接口或接口改版。

## 来源与验证边界

接口与详情推荐 `mamaAD` 字段参考 [ddgksf2013 小黄鱼净化规则](https://github.com/ddgksf2013/Rewrite/blob/master/AdBlock/GoofishAds.conf)（2026-11-04 读取，文件标注更新时间 2025-09-06）；首页 `AD`、搜索 `isAliMaMaAD` 和“我的”页面 `ability` 字段同时参考 [ishowshu/qx goofish.js](https://github.com/ishowshu/qx/blob/main/script/goofish.js)（同日读取，文件标注 2026-10-24）。页面脚本为本仓库独立编写，未采用上游仅保留白名单商品类型或批量删菜单的做法，不加载第三方脚本或 AMDC 脚本。

“我的”商品流采用参考规则 `del(.data.sections)` 的目标，对非数组结构仍透传。新增首页、搜索及本地信息流接口同样基于参考规则字段，未在用户 HAR 中捕获。更新插件时需同时更新脚本，本次脚本引用版本为 `20261104-3`。

与参考规则的边界差异：保留首页完整 `homeTopList`，不按“只保留 item”的白名单删除首页、本地和搜索未知卡片，也不按 `sectionBizCode` 白名单批量删“我的”菜单；未加入抓包未出现的 `iyes.youku.com` 整域屏蔽。参考 AMDC 脚本会对特定 App 的调度请求返回非原协议文本，可能改变后续连接方式；现有 HAR 未捕获 `/amdc/mobileDispatch`，本插件不据此强改传输链路，不能保证解决抓包缺少业务接口的问题。

视频路径来自用户提供的 HAR：153 条请求中，同一广告视频有 10 次直接访问，另有 6 次视频入口请求通过 HTTP 302 指向它。路径包含 `mama_searchad_algo_upload`，但 HAR 无法证明该视频对应开屏还是其他广告位。HAR 未捕获上述开屏 API；接口当前版本的适用性无法从此抓包确认。HAR、账号、签名和设备标识不纳入仓库。

第二份 HAR 共 311 条请求，同样包含上述广告视频的 10 次直接访问，仍未捕获开屏 API。新增的 `ipm.atm.youku.com/ipm` 和 `bdlog.tanx.com/imp` 请求不能证明是开屏下发接口，不据此扩大屏蔽范围。两份 HAR 可能包含重复流量，不将其数量视为独立广告展示次数。

语法依据：[Loon 官方 Rewrite 文档](https://nsloon.app/docs/Rewrite/rewrite_v2)。使用 `response.body.mock("text", "", 200)`，保持参考规则的 HTTP 200 空响应语义，不虚构业务 JSON。已做 HAR URL 回放、正反例路径匹配和 MitM 域名覆盖检查；这些检查不能代替 Loon 解析器或真机验证。

页面脚本验证命令：`node Loon/Script/Xianyu/tests/regression.cjs`。使用合成响应检查广告删除、普通商品和未知模块保留、分页字段保留、业务错误及解析失败透传，以及插件接口匹配边界。五份 HAR 都未包含上述页面业务接口，因此没有真实页面响应回放证据，当前 App 版本的字段适用性无法确认。

追加检查的三份 HAR 分别为 41、148、44 条请求，五份合计 697 条；逐文件回放共匹配广告视频目录 33 次、`df.tanx.com/spf3` 57 次，所有页面脚本及开屏接口均为零匹配。148 条请求的 HAR 额外证实了 `video-sh` 的广告素材目录。数量可能含重复录制与分段下载，不代表独立广告展示次数。没有依据屏蔽 `video.goofish.com` 的正常视频，或将无标记的普通 CDN 视频认定为广告。

回放命令可在测试命令后追加一个或多个 HAR 路径，测试读取本地文件、不上传也不保存其敏感数据；输出各文件的页面接口与开屏/曝光/视频/跟踪匹配数。合成页面测试与实际 HAR 的 URL 回放证据分别报告，不能将 URL 命中当作页面广告已消失。

尚未完成真机验证，无法保证开屏消失、倒计时跳过或广告占位折叠。启用后完全退出并重新启动闲鱼，检查开屏、登录、搜索、聊天和商品视频；可在 Loon 请求记录中确认规则命中。已有缓存可能继续展示，本插件不清理 App 本地缓存，也不要求卸载 App。
