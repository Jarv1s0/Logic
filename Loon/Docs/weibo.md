# 微博首页与发现页处理

[插件](../weibo.lpx) 的首页、发现页及相关广告配置响应统一交给 [weibo_feed.js](../Script/Weibo/weibo_feed.js)，不再同时调用旧首页或发现页处理器。

## 来源与兼容范围

采用用户提供的 [墨鱼微博助手配置](https://ddgksf2013.top/rewrite/WeiboEnhanced.conf) 对应的 [weibo_json.js](https://ddgksf2013.top/scripts/weibo_json.js) **0.1.59**。源站须使用 `User-Agent: surge` 读取；脚本在 `BEGIN UPSTREAM` 与 `END UPSTREAM` 之间原样保留，SHA-256 为：

```text
5ed91dbb4e764c1feecd8159a039f21a95499d5bffc55986595ba5e55c8f8657
```

- 处理入口：首页最新、推荐、未读、正向及游客信息流，发现页首次加载、翻页、顶部刷新，以及 `searchbarchange`、`push/daily`、`push/active`、`push/info`、`guest/push_active`。
- 关闭参考默认的“只显示热搜”、频道隐藏、话题链接隐藏和热搜布局改写，保留现有及未知发现频道、正常微博、分页、顶部入口与通知。日配置保留原有红包配置。
- 沿用本地 BigDay、问热搜、旧式热搜推广、帖子附属推广和原生广告标签清理；首页不再仅凭 `ad_state=1` 删除帖子，与有效参考的判定保持一致。
- 首页继续兼容 `data`／`status` 帖子结构、无 `category` 帖子及原有图片地址转换；只修改已存在且结构有效的图片尺寸对象。
- 只在脚本内将原插件支持的 `mapi`、`weibo.com` 别名归一为参考处理器识别的主机，不改写实际请求或网络类型。
- 从现有 `mainConfig` 继承自动刷新、首页头像提示、首页红点、消息数字、帖子 AI 按钮和视频结束动作的有效配置；不读取或覆盖另一插件的 `weibo_adblock_config_v3` 设置。
- 皮肤、会员图标、启动默认最新、顶部分组、详情、超话、视频和国际版继续使用原有处理入口。

## 验证

```powershell
node --check Loon/Script/Weibo/weibo_feed.js
node Loon/Script/Weibo/tests/regression.cjs
node Loon/Script/Weibo/tests/feed-reference.cjs
# 可选：传入本地参考抓包，额外回放真实响应
node Loon/Script/Weibo/tests/feed-reference.cjs <本地HAR路径>
```

本轮使用用户的参考插件抓包核对了 6 份响应：1 次首页、4 次发现加载、1 次发现顶部刷新。原样上游与抓包中记录的实际处理结果完整一致；兼容入口保留正常内容及分页，并清除样本中的信息流广告。对同一响应只改 `networktype` 为 Wi-Fi 或蜂窝标记时，输出一致。合成用例覆盖迁移入口唯一命中、四个主机别名、广告与正常内容、配置隔离、异常正文及原有界面选项。

这些结果证明本地回放行为，**不能确认旧插件出现 Wi-Fi／蜂窝差异的根因，也不能替代手机端验证**。修改需推送后才能通过插件中的远程脚本地址获取。HAR 可能含账号和鉴权数据，只在本地读取，不提交到仓库。
