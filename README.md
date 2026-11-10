# 🚀 Logic / Clash

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Core: Mihomo](https://img.shields.io/badge/Core-Mihomo%20(Meta)-orange)](https://github.com/MetaCubeX/mihomo)

基于 **Mihomo (Clash Meta)** 内核的高性能网络分流配置集。

另维护独立的 Loon 插件，不能导入 Mihomo / Clash。

Loon 插件统一使用官方新版 [Rewrite](https://nsloon.app/docs/Rewrite/rewrite_v2) 和 [Script](https://nsloon.app/docs/Script/script_v2) 语法，参数按[插件文档](https://nsloon.app/docs/Plugin/)传入；新版脚本配置至少需要 Loon 3.5.1 (983)，具体最低版本以插件头部为准。

- [小宇宙去广告](Loon/XiaoYuZhou.lpx)：拦截开屏及搜索推广，过滤首页推广横幅与头部；参考 ddgksf2013、fmz200，需启用 MitM，未完成真机验证。

- [闲鱼广告净化](Loon/Xianyu_remove_ads.lpx)：拦截开屏，过滤首页、搜索、详情推荐及我的页面推广；[安装、来源与验证边界](Loon/Docs/xianyu.md)。未完成真机验证。

- [悬浮时钟去广告](Loon/FloatingClock_remove_ads.lpx)：拦截抓包确认的推啊、Sigmob 和 1rtb 广告服务，无需 MitM；[安装与验证边界](Loon/Docs/floating-clock.md)。未完成真机验证。

- [好轻去广告](Loon/Haoqing_remove_ads.lpx)：清理开屏、轮播、商品推荐和悬浮推广，采用新版 Rewrite 语法；[安装与验证边界](Loon/Docs/haoqing.md)。

- [Google 搜索重定向](Loon/GoogleRedirect.lpx)：将指定 Google 地区搜索入口重定向到 `www.google.com`，保留搜索词和参数；[支持域名、安装与验证边界](Loon/Docs/google-redirect.md)。

- [航旅纵横去广告](Loon/umetrip.plugin)：基于 fmz200 合集，适配新版域名，过滤首页 Protobuf 广告、推广卡片及会员模块；[安装、来源与验证边界](Loon/Docs/umetrip.md)。该插件及脚本使用 GPL-3.0，见其独立许可证。

- [高德地图净化插件](Loon/Amap_remove_ads.lpx)：清理广告与推广，保留正常搜索结果及服务功能。
- [安装、修改边界与上游来源](Loon/Docs/amap.md)。
- [YouTube 插件](Loon/YouTube.lpx)：去广告、后台播放、双语字幕与智能换行、底栏控制及频道屏蔽；[安装说明与上游来源](Loon/Docs/youtube.md)。
- [B 站插件](Loon/bilibili.lpx)：同步 Sparkle 哔哩哔哩增强，支持自动更新并三方合并本地修改；[安装、同步机制与功能边界](Loon/Docs/bilibili.md)。该插件及配套上游文件使用 GPL-3.0，见其独立许可证。
