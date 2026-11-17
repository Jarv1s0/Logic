# 微博统一响应处理

[插件](../weibo.lpx) 将墨鱼配置覆盖的 **32 个业务接口、3 个开屏接口**统一交给 [weibo_feed.js](../Script/Weibo/weibo_feed.js)。脚本文件名沿用已发布地址，实际职责已覆盖完整参考响应链。

## 来源与兼容范围

采用用户提供的 [墨鱼微博助手配置](https://ddgksf2013.top/rewrite/WeiboEnhanced.conf) 对应的 [weibo_json.js](https://ddgksf2013.top/scripts/weibo_json.js) **0.1.59**。源站须使用 `User-Agent: surge` 读取；脚本在 `BEGIN UPSTREAM` 与 `END UPSTREAM` 之间原样保留，SHA-256 为：

```text
5ed91dbb4e764c1feecd8159a039f21a95499d5bffc55986595ba5e55c8f8657
```

- 处理入口与固定版本的 `WeiboCore.ROUTES` 一致，覆盖首页、发现、搜索、个人页、详情评论、视频、分组、提醒、推送及开屏配置；保留原插件支持的主机别名。
- 移除全部域名／URL 拒绝、请求阶段拒绝和 jq 改写。业务请求取得真实响应后再净化；`cardlist`、`searchall` 等接口只命中一个处理器，实时开屏不再提前返回空对象。
- 关闭参考默认的“只显示热搜”、频道隐藏、话题链接隐藏和热搜布局改写，保留现有及未知发现频道、正常微博、分页、顶部入口与通知。日配置保留原有红包配置。
- 沿用本地 BigDay、问热搜、旧式热搜推广、帖子附属推广和原生广告标签清理；首页不再仅凭 `ad_state=1` 删除帖子，与有效参考的判定保持一致。
- 首页继续兼容 `data`／`status` 帖子结构、无 `category` 帖子及原有图片地址转换；只修改已存在且结构有效的图片尺寸对象。
- 只在脚本内将原插件支持的 `mapi`、`weibo.com` 别名归一为参考处理器识别的主机，不改写实际请求或网络类型。
- 从现有 `mainConfig` 继承自动刷新、首页头像提示、首页红点、消息数字、帖子 AI 按钮和视频结束动作的有效配置；不读取或覆盖另一插件的 `weibo_adblock_config_v3` 设置。
- 首页与发现页保留上一轮的本地兼容清理，其他参考接口直接沿用上游响应处理，不叠加旧广告逻辑。
- 撤下 `client/interrupt` 的强制启动频道改写，以及旧版顶部分组删除、`get_grayfeature` 实验配置改写。`groups/allgroups/v2` 使用参考算法，不再额外删除“全部关注”和“超话社区”；墨鱼自身默认的 `homeStartupTab: "latest"` 与时间排序仍然保留。
- 皮肤、会员图标及国际版的独立响应处理继续保留，不与国内版业务接口重叠；国际版的旧请求拒绝规则也已移除。
- `weibo_main.js`、`weibo_ads.js`、`weibo_launch.js` 留作历史参考，当前插件不再加载它们。仅旧混合配置支持、未列入参考入口的接口恢复透传，因此不保证保留这些旧接口的额外净化效果。

## 验证

```powershell
node --check Loon/Script/Weibo/weibo_feed.js
node Loon/Script/Weibo/tests/regression.cjs
node Loon/Script/Weibo/tests/feed-reference.cjs
# 可选：传入本地参考抓包，额外回放真实响应
node Loon/Script/Weibo/tests/feed-reference.cjs <本地HAR路径>
```

`feed-reference.cjs` 从实际插件提取入口，检查所有参考路由及四个业务主机别名的单次命中、相邻路径、无请求拒绝／jq／旧处理器重叠，验证普通标签、开屏正常配置、广告过滤、配置隔离及异常正文。

本轮使用用户的参考插件抓包核对了 **14 份响应**。原样上游与抓包记录的结果完整一致；其中新增迁移的 8 份分组、个人页、提醒、推送、搜索配置和 Lua 广告配置，兼容入口也与参考结果完整一致。其余 6 份首页与发现响应保留正常微博、频道及分页，并清除样本中的信息流广告。对同一响应只改 `networktype` 为 Wi-Fi 或蜂窝标记时，输出一致。

`regression.cjs` 另行保留兼容层及历史处理器单元用例；历史脚本用例通过不代表这些旧逻辑仍在当前插件生效。

这些结果证明本地回放行为，**不能确认旧插件出现 Wi-Fi／蜂窝差异的根因，也不能替代手机端验证**。修改需推送后才能通过插件中的远程脚本地址获取。HAR 可能含账号和鉴权数据，只在本地读取，不提交到仓库。
