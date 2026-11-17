# 悬浮时钟去广告

- 插件：[`FloatingClock_remove_ads.lpx`](../FloatingClock_remove_ads.lpx)，最低要求 Loon `3.5.1(998)`，本地导入并启用。试验性清空抢购事件需启用 MitM，仅域名拦截不需要。

## 处理范围

拒绝以下广告服务主机：

- `s.tuia.cn`
- `tm.sigmob.cn`
- `sdk.1rtb.net`

域名规则对其他 App 使用同一广告 SDK 也生效。试验性清空 `scheduled/featured/list` 用于测试首页“抢购事件”入口，会一并清空该接口的热门列表。
