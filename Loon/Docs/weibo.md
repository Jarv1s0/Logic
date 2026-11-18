# 微博响应净化

[插件](../weibo.lpx) 用于国内版微博去广告与开屏净化，响应由 [weibo_feed.js](../Script/Weibo/weibo_feed.js) 处理。

## 功能

- 首页、发现页、搜索、视频、详情、评论及个人页的广告与推广清理，保留正常内容和分页
- 隐藏首页及详情的帖子车型推广标签、详情页的“大家都在搜”、行内分享与赞赏栏及店铺热卖卡
- 移除“我”页的“为你推荐”，以及消息「动态」里的“广告”和“荐读”卡
- 清理“更多功能”里的钱包广告、借款额度推广及已识别的活动和购物推广，保留钱包和常用功能
- 开屏与推送广告清理
- 顶部分组保留“全部关注”和“超话社区”，并优先选择“最新微博”

## 配置

读取已有 `mainConfig` 中的以下开关，默认均为 `true`：

`homeAutoRefresh`、`hideHomeTabAvatar`、`hideHomeTabRedDot`、`hideMessageTabNumber`、`hideFeedAiButton`、`hidePlaybackCompletionActions`

自动刷新允许 `null` 表示保持响应原值；其他键不参与处理。

## 维护边界

- 仅处理已识别的广告结构，未知字段和结构默认透传
- 国内版处理 34 个业务接口和 3 个开屏入口，不改写请求或网络类型
- 国际版、皮肤和图标使用各自独立脚本；历史 `weibo_main.js`、`weibo_ads.js`、`weibo_launch.js` 不再加载
- 仅读取上述开关，不读写其他插件的设置，不发起额外网络请求
- 需启用 MitM

## 验证

```powershell
node --check Loon/Script/Weibo/weibo_feed.js
node Loon/Script/Weibo/tests/regression.cjs
node Loon/Script/Weibo/tests/feed.cjs
# 可选：回放本地 HAR 中的真实发现页响应
node Loon/Script/Weibo/tests/har-replay.cjs <本地HAR路径>
```
