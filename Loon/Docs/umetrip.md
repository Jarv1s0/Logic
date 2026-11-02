# 航旅纵横去广告

在 Loon 中导入：

```text
https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/umetrip.plugin
```

启用插件、脚本及 MITM，并安装、信任 Loon 的 CA 证书。插件沿用现有路径，已安装该地址的用户更新插件即可。

## 同步范围与来源

2026-11-02 从 [fmz200/wool_scripts 的 blockAdsV2.plugin](https://github.com/fmz200/wool_scripts/blob/4b7830670baf235ed945085cb926dc499cf619e0/Loon/plugin/blockAdsV2.plugin) 提取航旅纵横部分：

- 拦截 `oss.umetrip.com/fs/advert/polite`，返回 404。
- 拦截 `discardrp.umetrip.com`、`startup.umetrip.com` 的 `/gateway/api/umetrip/native` 请求，返回 404。
- 对 `home.umetrip.com` 或 `114.115.217.129` 的同路径响应运行脚本；请求头 `rpid` 包含 `1000002` 或 `1000019` 时返回 404，其余透传。

[上游脚本](https://github.com/fmz200/wool_scripts/blob/4b7830670baf235ed945085cb926dc499cf619e0/Scripts/umetrip/umetrip_ads.js) 已存入 `Loon/Script/Umetrip/umetrip_ads.js`，插件引用本仓库副本。本次为手动同步，没有配置自动同步任务。

本地适配：将合集的条件表达式转换为 Loon `[Rewrite]`、`[Script]` 语法；将上游 `http?` 改为 `https?` 以覆盖 HTTP 和 HTTPS；为响应规则的两个主机添加统一分组，避免 IP 分支匹配任意路径；请求头名称按大小写不敏感查找，缺失或非字符串时透传。其余拦截条件保留上游行为。

## 风险与验证边界

上游明确提示“此条存在首页横幅误杀，可以禁止 MITM 域名”。同步后不能保证保留首页横幅；出现异常时可先停用插件。已做静态和模拟验证，尚未验证 Loon 真机加载、去广告效果及航班业务功能。

提取的插件和脚本按上游 GPL-3.0 分发，许可证原文位于 [LICENSE](../Script/Umetrip/LICENSE)，不适用仓库 README 中的 MIT 徽章。
