# Logic

个人维护的 Mihomo（Clash Meta）覆写配置与 Loon 插件集合，包含网络分流、广告过滤和部分应用功能调整。

## Mihomo / Clash 覆写配置

| 文件 | 策略组 | 用途 |
| --- | --- | --- |
| [Overwrite.yaml](Clash/configs/Overwrite.yaml) | 按 Google、YouTube、AI、游戏、GitHub、Telegram 等业务分组，并提供地区组 | 按业务分别选择代理地区 |
| [OneOverwrite.yaml](Clash/configs/OneOverwrite.yaml) | 仅保留一个 `Proxy` 选择组 | 统一手动选择代理节点 |

两份配置均包含 Fake-IP DNS、TUN、远程规则集、广告与跟踪拦截，以及国内外流量分流。未命中的流量交给 `Proxy`。

### 使用方式

1. 在客户端添加自己的节点或订阅；这两份文件不提供节点，也没有配置 `proxy-providers`。
2. 在客户端的覆写或合并配置入口加载其中一份 YAML，使用 Mihomo 内核运行。
3. 检查合并后的配置，再启用代理。两份文件都默认开启 TUN 和局域网访问，按设备与网络环境调整；单组版还包含个人使用的域名和进程规则。

DNS 段使用 `dns!` 键，加载前需确认客户端的覆写机制支持该写法。不要直接将文件作为完整的 Mihomo 配置运行。

## Loon 插件

插件入口位于 [`Loon/`](Loon/)，配套脚本位于 [`Loon/Script/`](Loon/Script/)，详细说明位于 [`Loon/Docs/`](Loon/Docs/)。Loon 插件不能导入 Mihomo / Clash。

### 使用方式

在 Loon 的插件管理中添加对应插件的 Raw 链接并启用。需要响应改写的插件还需开启 MitM、安装并信任证书；参数和最低版本要求以插件头部及各自文档为准。

插件使用新版 [Rewrite](https://nsloon.app/docs/Rewrite/rewrite_v2) / [Script](https://nsloon.app/docs/Script/script_v2) 语法，参数按[插件文档](https://nsloon.app/docs/Plugin/)传入。最低版本要求从 Loon 3.5.1 (983) 起，部分插件要求更高构建号。

### 插件目录

| 插件 | 主要处理范围 | 说明 |
| --- | --- | --- |
| [微博](Loon/weibo.lpx) | 开屏、信息流、发现页、评论和消息等页面净化，调整部分入口与红点 | [功能与验证边界](Loon/Docs/weibo.md) |
| [小红书](Loon/xiaohognshu.lpx) | 开屏、信息流、搜索、详情和评论区广告 | 参数见插件头部 |
| [哔哩哔哩](Loon/bilibili.lpx) | 广告过滤、首页与导航调整、置顶评论关键词过滤等 | [功能、上游同步与边界](Loon/Docs/bilibili.md) |
| [YouTube](Loon/YouTube.lpx) | 播放、信息流及搜索广告过滤，后台播放、字幕、底栏与频道控制 | [功能、设置与来源](Loon/Docs/youtube.md) |
| [Spotify](Loon/Spotify.lpx) | 音频广告与页面推广过滤，适配当前配置接口 | [Spotify 9.1.98+ 适配说明](Loon/Docs/spotify.md)；未完成真机验证 |
| [小宇宙](Loon/XiaoYuZhou.lpx) | 广告与运营资源过滤，关闭部分会员引导、AI 总结和相关单集推荐 | 参考 ddgksf2013、fmz200；包含非广告功能调整，未完成真机验证 |
| [闲鱼](Loon/Xianyu_remove_ads.lpx) | 开屏、首页、搜索、详情及我的页面推广 | [安装与验证边界](Loon/Docs/xianyu.md)；未完成真机验证 |
| [高德地图](Loon/Amap_remove_ads.lpx) | 开屏、信息流、搜索、打车及地点详情推广 | [处理范围与来源](Loon/Docs/amap.md) |
| [航旅纵横](Loon/umetrip.plugin) | 开屏、首页、个人页及行程页推广，会员模块过滤 | [处理范围与限制](Loon/Docs/umetrip.md) |
| [好轻](Loon/Haoqing_remove_ads.lpx) | 开屏、轮播、商品推荐和悬浮推广 | [处理范围与验证边界](Loon/Docs/haoqing.md) |
| [悬浮时钟](Loon/FloatingClock_remove_ads.lpx) | 已识别的第三方广告服务，试验性清空抢购事件 | [影响范围与验证边界](Loon/Docs/floating-clock.md)；未完成真机验证 |
| [Google 搜索重定向](Loon/GoogleRedirect.lpx) | 指定 Google 地区域名的首页与搜索入口重定向至 `www.google.com`，保留搜索词与参数 | [支持域名与使用说明](Loon/Docs/google-redirect.md) |
| [Fine Pro](Loon/FinePro.lpx) | 修改响应中的订阅信息 | 直接引用上游脚本，内容会随上游更新 |

### 使用边界

- 插件效果受应用版本和接口变化影响，本地脚本检查不能替代真机验证。
- 订阅或会员字段的修改不代表实际获得服务端权益；Spotify 的下载、音质及 Jam 等能力仍取决于服务端。
- 部分插件会过滤非广告模块，域名拦截也可能影响其他应用。启用前阅读对应说明和参数。
- B 站插件通过仓库中的 GitHub Actions 定时检查上游，并三方合并本地修改；具体机制见其文档。

## 来源与许可

本仓库包含自行维护及基于第三方项目适配的配置与脚本，来源以各插件头部、文档及脚本内署名为准。仓库根目录未提供统一许可证，不能将全部文件视为 MIT 授权。

- B 站插件及配套上游文件使用 GPL-3.0，见 [LICENSE](Loon/Script/Bilibili/LICENSE)。
- 航旅纵横插件及配套脚本使用 GPL-3.0，见 [LICENSE](Loon/Script/Umetrip/LICENSE)。
- YouTube 相关来源与许可见 [SOURCE.md](Loon/Script/YouTube/SOURCE.md) 及其 [licenses 目录](Loon/Script/YouTube/licenses/)。

转载或修改时请保留对应署名，并遵守各文件适用的许可证。
