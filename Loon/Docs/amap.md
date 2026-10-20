# 高德地图 Loon 插件

插件和响应脚本由本仓库维护，不再运行上游远程脚本；图标直接引用 [Semporia 手绘地图图标](https://raw.githubusercontent.com/Semporia/Hand-Painted-icon/master/Universal/Map.png)，仓库不保存图标副本。插件作者署名为 Jarv1s0，原作来源见下文。此插件仅适用于 Loon，不能导入 Mihomo / Clash。

## 安装与验证

维护约定：后续修改高德插件或其响应脚本时，同步将插件 `#!date` 更新为本次实际修改时间，使用北京时间（Asia/Shanghai，UTC+08:00），格式为 `YYYY-MM-DD HH:mm:ss`，精确到秒；不补写无法确认的历史修改时间。

仓库发布后，在 Loon 的插件页面添加：

```text
https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/Amap_remove_ads.lpx
```

启用插件、HTTPS 解密及对应的受信任证书后使用。上述远程地址只有在文件推送至 `master` 后才可用。与其他高德插件同时启用可能产生重写冲突。

2026-10-10 补充了首页和“我的”下拉卡片过滤。已安装旧版的用户需在 Loon 更新插件，并更新对应远程脚本；脚本 URL 带版本参数，以区分旧缓存。

根据用户提供的 HAR，确认首页 `ai.amap.com/v1/ai_rec/home_qs` 提供 SSE 推荐流，补回 `ai.amap.com` 解密域名。`reject-dict` 和只保留结束事件的 `20261010-3` 均收到“网络不畅”反馈。用户已确认 `20261010-4` 消除了此前的加载及“网络不畅”问题，但续导航与常用地点卡片恢复显示。`20261010-5` 额外过滤两类已识别的动态子卡片。`20261010-6` 新增房产详情清理；当前脚本版本为 `20261010-7`，补充移除房产详情的“发现·你的理想居所”和“发现好去处”。需同时更新插件及远程脚本，新过滤效果仍待真机验证。

不要求卸载高德；缓存可能使旧广告继续显示。重启应用并观察后续请求，不能以界面暂时不变判断规则一定无效。卸载重装会丢失本地数据，不作为默认步骤。

本地语法检查无需安装依赖：

```powershell
node --check Loon/Script/Amap/amap-new.js
```

下文测试数量为历史验证记录，测试文件已移除。真实 HAR 的验证见下一段。未在设备上验证 Loon 配置解析或 iOS JavaScript 运行时，不能保证所有版本均有效。界面效果需在设备上确认。

首页 SSE 接口用原始 HAR 的两条真实成功响应做旧版/新版对照：旧版只剩两个结束事件，丢失前面的内容事件；新版分别保留全部 4 / 10 个事件，每条仅清空两个瀑布列表并关闭分页，其余 JSON 字段一致。真实响应中服务端本来就存在 `WaterfallContainer.data.list: []`，此次沿用这一空列表结构，不构造会话或新的容器类型。思考事件、序号、区域引用和 `COMPLETE` 均保留。`20261010-5` 另按 `NestCard.props.children[].meta.dy_card_id` 过滤抓包确认的续导航（`VO_G2A3UGG3_CARD_LM2W5Y14`）与常用地点（`VO_KHYZDF9G_CARD_OC67DFOU`）子卡片，保留外层 `NestCard` 及其他未知子卡片；卡片标识变化时不会扩大删除范围。

最新故障 HAR 的两条首页请求均为 HTTP 200，耗时 661 / 686 ms；Loon 日志显示脚本执行约 16–17 ms，返回了旧版两个结束事件。这些证据不支持将该次异常归因于脚本超时，但无法证明客户端“网络不畅”的全部原因。首页修正时的 21 项本地回归测试通过。两条真实 HAR 再次重放：其中一条新增过滤两个目标子卡片，另一条与 `20261010-4` 输出一致；事件数量及序号均保持不变。测试仅证明响应改写和规则匹配，不代替新过滤效果的真机验证。HAR 与日志仅在本地排查，不存入仓库。

此前另重放了 9 条已有脚本响应，“我的”页面保留预期三类卡片。原始 HAR 没有旧 `/main-page` 请求，`/main-page-aiqs` 的 `data.cardList` 也为空，旧卡片白名单不足以屏蔽当前首页信息流。

房产详情使用本次 HAR 的 13 条真实 `/ws/shield/search/poi/detail` 响应进行旧版/新版对照：共移除 10 个服务、配套、房源或推荐模块实例，1 组配套快捷入口和 1 个纯经纪人电话按钮；13 条响应中的对应布局及元数据引用也已清理。除此之外，响应字段保持一致。该接口分批返回模块，因此每一批均需按同一 `house_all_expt_temp` 模板处理，不能仅依据某一批是否包含完整基础信息决定过滤。

`20261010-6` 的 25 项本地回归测试通过，覆盖房产模板隔离、标签与快捷入口引用、经纪人和普通电话区分、混合引用及未知结构。真实响应重放不代替设备显示效果验证，HAR 不提交到仓库。

`20261010-7` 根据新增 HAR 识别到 `quickLinksPortal.data.headerProps.title` 为“发现·你的理想居所”，`poiDetailWaterFeedTitle.data.title` 为“发现好去处”，后者内容由 `poiDetailWaterFeed` 分页提供。重放全部 13 条详情响应，与旧版输出相比额外移除 2 个理想居所入口、2 个好去处标题及 7 个信息流模块实例，并清理区域及已知元数据引用，其余字段一致。移除测试文件前，26 项本地回归测试通过，覆盖分批响应及其他模板透传；设备效果仍待确认。

## 修改边界

`20261020-5` 根据用户反馈，`20261020-4` 只清空了通勤套餐详情，未隐藏打车页面按钮。重新检查两份 HAR 后，在 `/ws/promotion-web/resource/home` 的 `data.other.data.icon.icon_list` 确认资源 `icon_id === "78888"`、`inner_type === 5601`，其点击地址指向通勤套餐详情。新增精确过滤该图标，保留其他图标；撤销 `/ws/car-place/show` 的详情删除及脚本匹配，恢复正常详情内容。仍为 4 条脚本引用，按钮实际显示效果待真机确认。

`20261020-4` 根据新增 HAR，识别到 `m5-zb.amap.com/ws/car-place/show` 返回的 `data.playMap.comboBuyShow` 标题为“通勤套餐”、`comboType` 为 `5`、参考金额为 `5000` 分。仅在标题与类型同时匹配时删除该套餐推广字段，保留其他活动、接口状态及未知结构；补入现有打车脚本分组，仍为 4 条脚本引用。此数据与用户描述的“50元、通勤超便宜”相符，但按钮是否随之隐藏尚需真机验证。

`20261020-3` 将 Loon 中同一高德脚本的 12 条引用按域名合并为 4 条，分别对应首页 SSE、页面与广告、打车与推广、地点详情；接口路径边界、响应处理参数及 JavaScript 分发逻辑保持不变。Loon 日志中的部分规则名称随分组合并。

用户随后确认首页快捷入口已恢复、当前效果满足需求，无需继续抓包。后续本地简化仅合并重复的数组检查与过滤逻辑，保留首页 SSE、房产详情、异常透传及全部过滤条件；469 组新旧对照（含本次真实 HAR 和构造的异常数据）响应正文及日志输出一致，语法检查通过。该验证不代表覆盖所有服务端响应结构。

`20261020-2` 根据用户提供的 HAR，确认 `/ws/faas/amap-navigation/main-page-assets` 的 `data.pull3.msgs` 包含“速来，今晚8点正式开卖！”，其 `is_ad` 为字符串 `"1"`。新增响应处理，仅过滤 `is_ad` 为 `"1"`、`1` 或 `true` 的消息，保留非广告通知、分类配置及其他字段。该文件中的“常去地点”SSE 卡片子项及瀑布列表已经为空，无法据此确认“回家、去单位、常去地点、编辑”一行消失的原因；`20261020-1` 的恢复改动经用户反馈仍无效，入口问题尚未解决，需在停用“高德首页信息流净化”规则后重新采集响应。HAR 仅用于本地排查，不提交到仓库。

`20261020-1` 按用户要求恢复首页常用地点快捷入口：旧 `/main-page` 白名单新增 `FrequentLocation`，新版首页 SSE 不再过滤常用地点子卡片 `VO_KHYZDF9G_CARD_OC67DFOU`。继续清空瀑布列表、隐藏续导航和已识别的目的地推荐。目标是保留“回家、去单位、常去地点、编辑”这一行；依据现有卡片识别恢复，当前高德版本的实际显示仍需真机确认。插件及脚本需同时更新至 `20261020-1`。

`20261014-1` 根据 2026-10-14 新增 HAR，在 10:25:06 的首页 SSE 响应中确认目的地导航推荐子卡片 `VO_3TG6YIWC_CARD_SHDHIDHR`，补入首页过滤清单。重放本次全部 6 条首页响应：移除 1 个目标子卡片，其余 5 条输出与旧版逐字一致；外层容器、事件数量、序号及其他字段保留。未知卡片、异常流透传及重复处理检查通过；真机效果仍待确认。插件及脚本需更新至 `20261014-1`。

- `/promotion-web/resource` 及 `/home` 删除 `banner`、`popup`，并精确过滤已确认的通勤套餐图标（`icon_id: "78888"`、`inner_type: 5601`），保留其他图标及响应字段。
- 原 jq 处理统一迁入 JavaScript，增加对象、数组检查；不修改的响应保留原始正文。
- 搜索结果不再按 `PoiCardUniversal` 白名单过滤，保留其他类型和未知卡片。
- 首页 `/ws/faas/amap-navigation/main-page` 的 `data.cardList` 保留 `LoginCard`、`FrequentLocation`，继续隐藏 `ContinueNavigationCard`；不修改地图图层列表。
- “我的” `/ws/shield/dsp/profile/index/nodefaasv3` 的 `data.cardList` 仅保留 `MineNewFootprintCard`、`MineNewBEntranceCardV4`、`MineNewBEntranceCardV3`、`MyOrderCard`；不删除顶层足迹、会员等字段。
- 两处页面卡片列表按用户要求精简，白名单外的有效 `dataKey` 卡片也会删除，不保证全是广告；无法识别的数据结构透传。此白名单不应用于搜索结果。
- 当前首页信息流由 `/v1/ai_rec/home_qs` 的 SSE 响应提供。识别到瀑布列表或目标动态子卡片、空 markdown 成功结束事件及其后的 `COMPLETE` 时，清空瀑布列表、过滤续导航和已识别的目的地推荐子卡片并停止分页；保留常用地点子卡片、其余事件和未知子卡片。无匹配内容、未完成、解析失败或未知事件类型时整段透传；其他 AI 接口不新增处理。
- 地点详情保留门票、电影、油价、订房及其他非明确广告模块，不改地图标识和商家 logo。
- 房产详情仅在 `data.template === "house_all_expt_temp"` 时移除 `houseAgentService`、`surroundFacility`、`surroundHouseTab`、`houseShelf`、`commonGoodsShelf`、`similarShopRecommend`、`nearbyRecommendModule`、`quickLinksPortal`、`poiDetailWaterFeedTitle`、`poiDetailWaterFeed`；覆盖经纪人服务、配套、房源及相关服务推荐，以及“发现·你的理想居所”入口和“发现好去处”标题、信息流。其他模板不删除这些模块，尤其保留餐饮、酒店等正常商品货架。
- 同步清理 `regions`、已知元数据引用、`anchor.data.items[].anchor` 及 `poiDetailNewBeltV2.data.belt.list[].anchor`。混合引用只删目标，未知入口保留；配套快捷入口全部清空时移除该快捷模块及引用。
- 房产基础信息的电话选项，仅过滤 `material.dial_virtual_txt` 明确包含“经纪人提供服务”的 `multiVirtualPhone` 项。全部号码均为经纪人且没有其他跳转入口时，移除对应电话按钮；普通电话、地图、导航、收藏及评价内容保留。
- 打车保留完整工具箱及分享地址图标，酒店仅移除已知优惠弹窗及其引用，不重写页面布局。
- 解除评价、问题反馈、地图渲染、顶部通知、公共出行推荐和其他 AI 推荐接口处理；用途或结构不足以支持整段删除。
- 解除 `/ws/fluorite/resource` 整段拦截及支付成功信息接口拦截，避免在无真实响应证据时屏蔽整段资源或支付页面信息。
- 保留上游明确标记的开屏、营销搜索、广告提示、附近店铺推荐、签到推广及路线打车导流规则，并限制完整路径边界。
- HTTP 调度拦截不再迁入：没有验证其必要性与影响，避免干预非广告调度请求。
- 以上取舍可能保留更多推广内容，以减少正常功能误删。后续扩展应先取得脱敏真实响应，确认字段用途。

## 上游来源

原作者：树先生。迁移日期：2026-10-10。

- [原插件快照](https://github.com/ishowshu/loon/blob/e0b1e58d6e5a67707a2823c68ca2aeef966b510f/plugin/amap-new.lpx)
- [原脚本快照](https://github.com/ishowshu/qx/blob/d38e2289f4f388dfc55aaa8f19c8d002d828f62a/script/amap-new.js)
- [首页过滤参考](https://github.com/ishowshu/qx/blob/d38e2289f4f388dfc55aaa8f19c8d002d828f62a/script/amap.js)：`main-page` 的卡片白名单；本仓库原有 `Loon/Amap_remove_ads.plugin` 也覆盖该接口，现已更新为本次维护版本并改名为 `Loon/Amap_remove_ads.lpx`。
- [原图标快照](https://github.com/ishowshu/loon/blob/e0b1e58d6e5a67707a2823c68ca2aeef966b510f/icon/gaode.png)

抓取文件 SHA-256：

```text
插件 5DE336CBA5ECC2E96A28B01AA3543DED20BD28FA2A19F95C7DB14CCC80C89882
脚本 38E5772EB450D2F7EEB8D8F29011E470243367967FD01C907EC8178771F2F4CE
图标 54AF23CFA49B9D33F8883039CE2485A31028F68356E95EF456ABD6E264477CB1
```

上游脚本声明“当前文件内容仅供个人学习和研究使用，若使用过程中发生任何问题概不负责”。抓取时两个上游仓库根目录的 `LICENSE` 地址均返回 404，无法确认另有何种授权。保留来源和声明，不将仓库 README 的 MIT 徽章视为对这些第三方内容的重新授权。
