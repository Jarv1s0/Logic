# 微博响应净化

[插件](../weibo.lpx) 的国内版业务与开屏响应由本仓库维护的 [weibo_feed.js](../Script/Weibo/weibo_feed.js) 处理。已移除内嵌的混淆上游代码；不再以上游输出一致作为验收条件。

## 行为约定

- “我的”页面不注入插件设置入口；删除顶层和嵌套列表中 `weibo_local_settings_v3` 历史入口，保留微博本身的普通设置、相册和其他正常模块。
- 首页按明确广告标志过滤，兼容 `data`、`status` 和无 `category` 的帖子；不单凭 `ad_state=1` 删除首页或个人页微博。保留已有图片尺寸对象的地址转换。
- 发现页保留现有和未知频道、正常热搜及分页；移除明确广告、BigDay 品牌入口、“问热搜”横幅和已识别的热搜推广。
- 搜索、视频、详情和评论清理明确广告；支持 `items`、`statuses`、`cards`、`card_group` 等已知内容容器，不遍历转发引用正文。个人页按稳定标识或精确模块标题清理推广，不做全文关键词删除。
- 开屏只清空已存在的 `ads`、`cached_ad.ads` 广告数组，预加载延长展示间隔；保留其余配置。推送相关响应只处理已识别的 `ug_adv` 开关，保留红包及未知配置。
- 顶部分组保留“全部关注”和“超话社区”；存在“最新微博”时将其置前并选择关注首页。无匹配分组时透传，不写入账号状态。
- 首页头像提示、红点、消息汇总数字、帖子 AI 入口、视频结束动作和自动刷新沿用现有配置。签到、直播列表及视频提醒仅按已识别的结构处理；视频频道保留服务端列表与排序。
- 国内版保留 32 个业务接口和 3 个开屏入口，兼容四个业务主机别名；按实际主机和路径分派，不改写请求或网络类型。不配置请求拒绝、域名拒绝或 jq 改写。
- 国际版、皮肤和图标继续使用各自独立脚本。历史 `weibo_main.js`、`weibo_ads.js`、`weibo_launch.js` 不被当前插件加载，未配置的旧接口仍透传。

配置仅读取已有 `mainConfig` 中的 `homeAutoRefresh`、`hideHomeTabAvatar`、`hideHomeTabRedDot`、`hideMessageTabNumber`、`hideFeedAiButton` 和 `hidePlaybackCompletionActions`。默认均为 `true`；自动刷新允许 `null` 表示保持响应原值。其他键和无效类型不参与处理，不读写另一插件的设置，不提供内嵌设置页或额外网络请求。

这些是本插件的维护边界，不保证保留其他插件的全部界面调整及广告算法；未知字段和未知结构默认透传。

## 验证

```powershell
node --check Loon/Script/Weibo/weibo_feed.js
node Loon/Script/Weibo/tests/regression.cjs
node Loon/Script/Weibo/tests/feed.cjs
# 可选：回放本地 HAR 中的真实发现页响应
node Loon/Script/Weibo/tests/har-replay.cjs <本地HAR路径>
```

`feed.cjs` 验证当前插件入口、个人页设置入口删除与普通设置保留、广告过滤、内容和分页保留、异常正文、配置隔离、网络标记一致性及开屏正常配置。`regression.cjs` 对已配置接口实际加载当前插件指定的脚本；未配置的旧接口只保留历史单元用例，其通过不代表该功能仍生效。

当前改动已通过本地语法与合成回归验证，并对旧提交复现了个人页设置入口注入。此次没有本地 HAR 可供重新回放，不能沿用旧版“14 份响应与上游一致”的结论，也不能据此确认手机端效果或 Wi-Fi／蜂窝问题根因。远程安装需先发布仓库改动并更新插件／脚本缓存。HAR 可能含账号及鉴权数据，仅在本地使用，不提交到仓库。
