# 高德地图 Loon 插件

插件、响应脚本和图标均由本仓库维护，不再运行上游远程脚本。此插件仅适用于 Loon，不能导入 Mihomo / Clash。

## 安装与验证

仓库发布后，在 Loon 的插件页面添加：

```text
https://raw.githubusercontent.com/Jarv1s0/Logic/master/plugin/amap-new.lpx
```

启用插件、HTTPS 解密及对应的受信任证书后使用。上述远程地址只有在文件推送至 `master` 后才可用。与其他高德插件同时启用可能产生重写冲突。

2026-10-10 补充了首页和“我的”下拉卡片过滤。已安装旧版的用户需在 Loon 更新插件，并更新对应远程脚本；脚本 URL 带版本参数，以区分旧缓存。

根据用户提供的 HAR，确认首页 `ai.amap.com/v1/ai_rec/home_qs` 提供 SSE 推荐流，补回 `ai.amap.com` 解密域名。`reject-dict` 和只保留结束事件的 `20261010-3` 均收到“网络不畅”反馈。当前 `20261010-4` 保留完整事件链，仅清空 `WaterfallContainer` 的 `data.list` 并将结束事件的 `has_more` 改为 `false`。需同时更新插件及远程脚本；是否消除客户端异常仍待真机验证。

不要求卸载高德；缓存可能使旧广告继续显示。重启应用并观察后续请求，不能以界面暂时不变判断规则一定无效。卸载重装会丢失本地数据，不作为默认步骤。

本地验证无需安装依赖：

```powershell
node --check script/amap-new.js
node --test tests/amap.test.cjs
```

通用回归测试运行响应脚本并检查插件匹配规则，输入为模拟数据；真实 HAR 的验证见下一段。未在设备上验证 Loon 配置解析或 iOS JavaScript 运行时，不能保证所有版本均有效。界面效果需在设备上确认。

首页 SSE 接口用原始 HAR 的两条真实成功响应做旧版/新版对照：旧版只剩两个结束事件，丢失前面的内容事件；新版分别保留全部 4 / 10 个事件，每条仅清空两个瀑布列表并关闭分页，其余 JSON 字段一致。真实响应中服务端本来就存在 `WaterfallContainer.data.list: []`，此次沿用这一空列表结构，不构造会话或新的容器类型。功能卡片、思考事件、序号、区域引用和 `COMPLETE` 均保留，因此首页可能保留天气等功能内容。

最新故障 HAR 的两条首页请求均为 HTTP 200，耗时 661 / 686 ms；Loon 日志显示脚本执行约 16–17 ms，返回了旧版两个结束事件。这些证据不支持将该次异常归因于脚本超时，但无法证明客户端“网络不畅”的全部原因。20 项本地回归测试通过，仅证明响应改写和规则匹配，不代替真机验证。HAR 与日志仅在本地排查，不存入仓库。

此前另重放了 9 条已有脚本响应，“我的”页面保留预期三类卡片。原始 HAR 没有旧 `/main-page` 请求，`/main-page-aiqs` 的 `data.cardList` 也为空，旧卡片白名单不足以屏蔽当前首页信息流。

## 修改边界

- `/promotion-web/resource` 及 `/home` 只删除 `banner`、`popup`，解决整段拦截与局部修改重叠。
- 原 jq 处理统一迁入 JavaScript，增加对象、数组检查；不修改的响应保留原始正文。
- 搜索结果不再按 `PoiCardUniversal` 白名单过滤，保留其他类型和未知卡片。
- 首页 `/ws/faas/amap-navigation/main-page` 的 `data.cardList` 仅保留 `ContinueNavigationCard`、`FrequentLocation`、`LoginCard`；不修改地图图层列表。
- “我的” `/ws/shield/dsp/profile/index/nodefaasv3` 的 `data.cardList` 仅保留 `MineNewFootprintCard`、`MineNewBEntranceCardV4`、`MineNewBEntranceCardV3`、`MyOrderCard`；不删除顶层足迹、会员等字段。
- 两处页面卡片列表按用户要求精简，白名单外的有效 `dataKey` 卡片也会删除，不保证全是广告；无法识别的数据结构透传。此白名单不应用于搜索结果。
- 当前首页信息流由 `/v1/ai_rec/home_qs` 的 SSE 响应提供。识别到瀑布列表、空 markdown 成功结束事件及其后的 `COMPLETE` 时，清空瀑布列表并停止分页；其余事件和功能卡片保留。无已知列表、未完成、解析失败或未知事件类型时整段透传；其他 AI 接口不新增处理。
- 地点详情保留门票、电影、油价、商品、订房及其他非明确广告模块，不改地图标识和商家 logo。
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
- [首页过滤参考](https://github.com/ishowshu/qx/blob/d38e2289f4f388dfc55aaa8f19c8d002d828f62a/script/amap.js)：`main-page` 的卡片白名单；本仓库已有 `Loon/Amap_remove_ads.plugin` 也覆盖该接口。
- [原图标快照](https://github.com/ishowshu/loon/blob/e0b1e58d6e5a67707a2823c68ca2aeef966b510f/icon/gaode.png)

抓取文件 SHA-256：

```text
插件 5DE336CBA5ECC2E96A28B01AA3543DED20BD28FA2A19F95C7DB14CCC80C89882
脚本 38E5772EB450D2F7EEB8D8F29011E470243367967FD01C907EC8178771F2F4CE
图标 54AF23CFA49B9D33F8883039CE2485A31028F68356E95EF456ABD6E264477CB1
```

上游脚本声明“当前文件内容仅供个人学习和研究使用，若使用过程中发生任何问题概不负责”。抓取时两个上游仓库根目录的 `LICENSE` 地址均返回 404，无法确认另有何种授权。保留来源和声明，不将仓库 README 的 MIT 徽章视为对这些第三方内容的重新授权。
