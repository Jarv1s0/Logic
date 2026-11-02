# 哔哩哔哩增强

- 插件：[`bilibili.lpx`](../bilibili.lpx)；要求 iOS/iPadOS 15、Loon 3.5.1(992) 或更高版本，启用 MITM 并信任证书。
- 安装地址：`https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/bilibili.lpx`。
- 上游：[kokoryh/Sparkle](https://github.com/kokoryh/Sparkle)，[原插件](https://github.com/kokoryh/Sparkle/blob/master/release/loon/plugin/bilibili.lpx)，[使用说明](https://github.com/kokoryh/Sparkle/blob/master/src/script/bilibili/README.md)。
- 首次同步日期：2026-11-02。保留上游默认功能，将插件内的 4 个脚本和 2 个 jq 文件引用改为本仓库地址；这些地址在上游快照进入本仓库时统一替换。插件 `#!date` 记录本地更新时间，使用北京时间（UTC+8），格式为 `YYYY-MM-DD HH:mm:ss`。
- 上游文件使用 GNU GPL v3，许可证保存在 [`LICENSE`](../Script/Bilibili/LICENSE)，不适用仓库首页的 MIT 标识。当前快照的完整上游提交号、文件映射和上游基线 SHA-256 见 [同步状态](../../.github/upstream/bilibili.json)。对应源码位于 `https://github.com/kokoryh/Sparkle/tree/<revision>`，将 `<revision>` 替换为状态文件中的提交号；该提交的源码归档为 `https://github.com/kokoryh/Sparkle/archive/<revision>.tar.gz`。

## 自动更新与本地修改

[GitHub Actions](../../.github/workflows/sync-bilibili.yml) 每天 04:23 UTC 检查上游，也支持在 Actions 页面手动运行。每次先锁定一个上游提交，再下载全部配套文件，避免下载过程中混入不同提交的内容。上游 B 站文件没有变化时不创建提交。

每次成功同步到有变化的上游文件后，自动刷新插件的北京时间。日期字段不参与三方合并，不会仅因双方更新时间不同产生冲突。手动修改插件或配套文件并发布时，也需刷新插件日期；上游原始日期可从同步状态对应的上游提交查看。

可以直接修改并提交 `Loon/bilibili.lpx` 或 `Loon/Script/Bilibili/` 内的功能文件，不要手动修改同步状态中的提交号和校验值。下次更新使用三方合并：

```text
旧上游（状态文件记录的基线）
  + 本仓库中的修改
  + 新上游的修改
  → 合并后的插件、脚本和 jq 文件
```

不冲突的本地修改会保留。双方修改同一段、同步文件被删除、出现未收录的上游依赖或下载失败时，同步停止，不写入本轮下载的文件或推进基线。压缩后的 JavaScript 通常集中在单行，本地和上游同时修改时更容易冲突，不能保证所有定制都可自动合并。

合并成功并通过脚本语法检查后，工作流只提交 B 站插件、配套文件和同步状态到 `master`，不使用强制推送。若运行期间远端出现新提交，本轮推送会失败；重新运行工作流即可从最新分支再合并。上游新增、改名依赖时需调整同步清单，不能自动猜测迁移方式。

工作流推送后才会在 GitHub 生效。仓库须允许运行 Actions，并允许该工作流使用 `GITHUB_TOKEN` 写入 `master`；分支保护要求 PR 时，自动提交会被拒绝。失败信息在 Actions 运行日志中查看；邮件通知取决于个人 GitHub 通知设置。

## 手动同步与冲突处理

本地需要 Python 3.12 或更高版本及 Git，无额外 Python 依赖。在仓库根目录运行：

```powershell
python scripts/sync_bilibili.py
```

如果出现冲突，先查看新上游版本，手动将报错文件合并为需要保留的最终内容。确认已包含指定上游提交的改动后，使用完整提交号和文件路径确认解决结果：

```powershell
python scripts/sync_bilibili.py --revision <完整上游提交号> --resolved Loon/bilibili.lpx
```

`--resolved` 可重复指定文件。它会保留指定文件的当前内容，并将其上游基线推进到该提交；其他文件仍正常合并。此操作信任人工合并结果，不能用来跳过尚未处理的冲突。自动工作流不会使用此选项。

## 功能边界与验证

保留上游的首页和导航重排、置顶评论关键词过滤、会员字段修改及端口拦截等行为。关键词过滤可能误删正常置顶评论；会员字段修改不代表服务器授予真实会员权益。`bsbsb.top`、chronos 资源和其他外部服务仍按上游逻辑访问，未全部镜像到本仓库。

按上游说明，B 站 9.17.0 及以上版本的空降助手使用章节标记，需要手动点击跳转。实际行为以当前上游和客户端版本为准。

自动验证覆盖同步合并逻辑及 4 个脚本的 JavaScript 语法，不覆盖 Loon/jq 运行时或 B 站真机行为。客户端是否及时取得更新，还取决于 Loon 的插件更新和脚本缓存机制。
