# 航旅纵横去广告

在 Loon 中导入：

```text
https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/umetrip.plugin
```

启用插件、脚本及 MITM，并安装、信任 Loon 的 CA 证书。插件沿用现有路径，已安装该地址的用户需更新插件配置及脚本，确认版本 `20261102-3`，新增域名及二进制模式才会生效。

## 会员模块屏蔽：20261102-3

按用户要求屏蔽会员模块及会员广告。HAR 确认此前遗漏“我的”页会员内容及首页服务列表中的会员入口；新增 `umerp.umetrip.com` 响应处理：

- `1100001` 的 `7.1.11.5` 中删除模板 `1297`（会员卡）、`111310`（礼金中心及视频会员推广）与标记为 `ADVERT` 的广告组。
- `1370286` 是会员权益页数据，删除其 `7.1.2` 内容，保留协议外层及其他未知字段。
- 首页移除 `7.1.27` 的会员权益图片配置；首页与“我的”页服务卡 JSON 中移除 `department=equity`、标题或服务名称含“会员／航旅会”、或跳转指向 `payMember`、`memberCardbag`、`memberequity.umetrip.com` 的会员项。同步重建 `childrenIndex`，避免删除后索引错位。
- 拦截 `oss.umetrip.com/fs/equityCenter/static/` 和 `/fs/membership/rights/` 的会员权益素材。主动进入会员页面的素材展示也会受影响。航司标志、头像、常客卡、机票订单、票券及客服不按这些条件删除。

本轮 186 次脚本执行通过：重放 5 条首页、2 条瀑布流、2 条开屏、2 条“我的／会员权益”响应，其余 140 条航旅请求原样透传；旧版对新增会员场景未清理、新版通过。目标响应处理后不再包含“会员／航旅会”及会员跳转文本，未改动数据按完整字节比对验证，重复处理不变。HAR 不入库。该结果仅覆盖本次抓包与模拟案例，真机界面及未抓到的会员位置仍待确认。

## 抓包适配：20261102-2

根据用户提供的 HAR，确认新版首页 `rpid=1000002` 来自 `umehome.umetrip.com`，开屏配置 `1000019` 来自 `sns.umetrip.com`，首页瀑布流 `1000029` 来自 `opactivity.umetrip.com`。旧版仅匹配 `home.umetrip.com` 和 IP，未覆盖这些响应。

首页响应为 Protobuf，不能沿用旧脚本对 `1000002` 整包返回 404 的方式。新版开启 Loon 二进制响应处理，仅沿已确认字段路径修改：

- 首页 `7.1.2.5`：删除字段 `37=ADVERT` 的广告组，以及模板 `111288`（商城虚拟卡）、`111281`（机票直销）、`111326`（发现目的地）、`1296`（回归礼包）。
- 首页瀑布流 `7.1.1.5`：仅在模板 `111286` 内删除卡片 ID `306222/306379/306214/306225/306219/306244/306220/306245`，对应酒店、特价机票、租车、权益、热议、攻略及底部推荐跳转；保留机场概览和未知卡片。
- 开屏配置仅在 `rpid` 精确等于 `1000019` 时返回 404；不屏蔽整个 `sns` 域名。
- 此版不处理启动配置 `umestartup`、用户信息及航班动态；后续 `20261102-3` 补入上方会员过滤。普通服务入口、飞行回忆、航线图及未识别字段保留，异常响应透传。

本轮真实 HAR 重放覆盖 5 条首页、2 条瀑布流、2 条开屏配置及 142 条其他航旅请求；176 次脚本执行通过，包含旧版失败、新版过滤、重复处理不变及异常透传验证。HAR 不入库。执行回归：

```sh
node Loon/Script/Umetrip/tests/regression.cjs
# 附本地航旅 HAR 路径可重放实际响应：
node Loon/Script/Umetrip/tests/regression.cjs /path/to/capture.har
```

## 初始同步范围与来源

2026-11-02 从 [fmz200/wool_scripts 的 blockAdsV2.plugin](https://github.com/fmz200/wool_scripts/blob/4b7830670baf235ed945085cb926dc499cf619e0/Loon/plugin/blockAdsV2.plugin) 提取航旅纵横部分：

- 拦截 `oss.umetrip.com/fs/advert/polite`，返回 404。
- 拦截 `discardrp.umetrip.com`、`startup.umetrip.com` 的 `/gateway/api/umetrip/native` 请求，返回 404。
- 初始上游脚本对 `home.umetrip.com` 或 `114.115.217.129` 的同路径响应处理，请求头 `rpid` 包含 `1000002` 或 `1000019` 时返回 404。此行为已由上方抓包适配取代，首页不再整包拦截。

[上游脚本](https://github.com/fmz200/wool_scripts/blob/4b7830670baf235ed945085cb926dc499cf619e0/Scripts/umetrip/umetrip_ads.js) 已存入 `Loon/Script/Umetrip/umetrip_ads.js`，插件引用本仓库副本。本次为手动同步，没有配置自动同步任务。

初始本地适配：转换为 Loon `[Rewrite]`、`[Script]` 语法；将上游 `http?` 改为 `https?`；为响应规则的两个主机添加统一分组，避免 IP 分支匹配任意路径；兼容请求头大小写及缺失情况。当前脚本在此基础上增加上述 Protobuf 过滤。

## 风险与验证边界

上游明确提示“此条存在首页横幅误杀，可以禁止 MITM 域名”。图片拦截规则仍保留，且新版主动过滤广告横幅和已确认的推广卡，不能保证保留全部营销内容；出现异常时可先停用插件。尚未验证 Loon 真机加载、实际布局和全部航班业务功能，也无法确认当前抓包时插件是否启用：已有拦截规则覆盖的广告图片在 HAR 中仍为 200。重放通过不能证明设备上已生效，也不能保证覆盖未抓到的广告。

提取的插件和脚本按上游 GPL-3.0 分发，许可证原文位于 [LICENSE](../Script/Umetrip/LICENSE)，不适用仓库 README 中的 MIT 徽章。
