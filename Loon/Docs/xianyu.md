# 闲鱼广告净化

- 插件：[`Xianyu_remove_ads.lpx`](../Xianyu_remove_ads.lpx)，要求 Loon 3.5.1(998) 或更高，启用 MitM 并信任证书。
- [安装直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/Xianyu_remove_ads.lpx)。

## 处理范围

- 开屏与曝光接口：匹配 goofish 域名的 `splash.ads`、`ad.expose`，返回 HTTP 200 空文本
- 素材与跟踪：拦截已确认的广告视频目录和 `df.tanx.com/spf3` 跟踪请求
- 页面脚本 [xianyu.js](../Script/Xianyu/xianyu.js)：清理首页、搜索、本地信息流、商品详情和“我的”页面中标记为 `AD`/`mamaAD` 的卡片与推荐，保留正常商品和未知模块

仅处理 HTTP 200 且 `ret` 为 `SUCCESS::` 的响应；解析失败和未知结构透传。
