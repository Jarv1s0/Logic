# Google 搜索重定向

- 插件：[`GoogleRedirect.lpx`](../GoogleRedirect.lpx)，要求 Loon 3.5.1(998) 或更高，启用 MitM 并信任证书。
- [安装直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/GoogleRedirect.lpx)。

## 功能

将 `g.cn`、`google.cn`、`google.com.hk`、`google.co.jp` 等地区域名的首页、`/search`、`/webhp` 临时重定向到 `https://www.google.com`，保留路径和查询参数（HTTP 302）。不匹配其他路径或子域名，不改 DNS、代理策略和出口 IP。

## 来源与边界

规则参考 [zqzess 的旧规则](https://github.com/zqzess/rule_for_quantumultX/blob/master/Loon/Rewrite/zqzess_Rewrite.conf) 重新编写，修正路径/参数丢失和域名边界过宽。Google 已逐步将国家域名统一跳转到 `google.com`，本插件只处理客户端重定向，无法阻止服务端后续跳转。
