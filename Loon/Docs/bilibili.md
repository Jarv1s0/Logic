# 哔哩哔哩增强

- 插件：[`bilibili.lpx`](../bilibili.lpx)，要求 iOS/iPadOS 15、Loon 3.5.1(992) 或更高，启用 MITM 并信任证书。
- [安装直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/bilibili.lpx)。
- 上游：[kokoryh/Sparkle](https://github.com/kokoryh/Sparkle)。文件使用 GPL-3.0，许可证见 [`LICENSE`](../Script/Bilibili/LICENSE)。

## 功能

保留上游的首页与导航重排、置顶评论关键词过滤、会员字段修改及端口拦截等行为。关键词过滤可能误删正常置顶评论，会员字段修改不代表真实会员权益。

## 同步

[GitHub Actions](../../.github/workflows/sync-bilibili.yml) 每天自动检查上游，本地修改与上游新版本三方合并，不冲突的改动会保留；插件 `#!date` 使用北京时间记录本地更新时间。手动同步：

```powershell
python scripts/sync_bilibili.py
```

出现冲突时先手动合并文件，再用 `python scripts/sync_bilibili.py --revision <提交号> --resolved <文件>` 确认。

## 验证边界

自动检查覆盖同步合并逻辑和脚本语法，不覆盖 Loon/jq 运行时或真机行为。
