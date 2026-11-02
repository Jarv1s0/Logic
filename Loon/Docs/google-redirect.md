# Google 搜索重定向

- 插件：[`GoogleRedirect.lpx`](../GoogleRedirect.lpx)。要求 Loon 3.5.1(998) 或更高版本；启用插件、MitM，并安装及信任证书。
- [插件直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/GoogleRedirect.lpx)：在 Loon 中添加此插件地址。
- 支持 `g.cn`，以及 `google.cn`、`google.com.hk`、`google.co.jp`、`google.co.uk`、`google.fr`、`google.de`、`google.com.tw`、`google.com.sg`、`google.com.au`、`google.co.kr`、`google.co.in`、`google.ca`，包括各自的 `www` 形式。
- 仅将以上域名的首页、`/search` 和 `/webhp` 入口临时重定向到 `https://www.google.com`，保留路径和完整查询参数。例如 `https://www.google.com.hk/search?q=loon&hl=zh-CN` 转为 `https://www.google.com/search?q=loon&hl=zh-CN`。
- 不匹配其他路径、其他子域名或 `google.com`，不修改 DNS、代理策略和出口 IP，也不固定搜索结果地区、语言。账户、Cookie 和出口位置仍可能影响结果。
- 不使用 `/ncr`，不依赖远程脚本。MitM 会解密所列域名的 HTTPS 流量，仅重定向规则按上述路径匹配。

## 来源与验证边界

参考需求来自 [zqzess 的旧规则](https://github.com/zqzess/rule_for_quantumultX/blob/master/Loon/Rewrite/zqzess_Rewrite.conf)，本插件重新编写匹配规则，修正原规则丢失路径、查询参数及域名边界过宽的问题，并增加上述地区域名。

使用新版 `[Rewrite]` DSL：`request if … as google then redirect(302, "https://www.google.com${google.1}")`，通过命名匹配结果保留路径和查询参数。状态码保持 302，域名与路径范围不变。

Google 已于 [2025-04-15 公告](https://blog.google/products/search/country-code-top-level-domains/)逐步将国家域名统一跳转到 `google.com`；本插件只负责客户端域名重定向，无法保证阻止服务端的所有后续跳转。

本次仅做规则匹配、参数保留、域名边界、重定向循环及 MitM 域名覆盖的本地校验，未进行 Loon 真机验证。
