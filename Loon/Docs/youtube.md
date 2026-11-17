# YouTube 插件

- 插件：[`YouTube.lpx`](../YouTube.lpx)，要求 Loon 3.5.1(983) 或更高，启用 MITM 并信任证书。
- [安装直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/YouTube.lpx)。
- 固定版本、源码、许可与构建说明见 [`SOURCE.md`](../Script/YouTube/SOURCE.md)。

## 功能与设置

- 播放去广告、后台播放、播放地区、首页 Shorts 隐藏、频道屏蔽
- 底栏控制：隐藏发布按钮、隐藏 Shorts（默认关闭）
- 字幕：翻译（默认关闭，支持简繁中/英/日/韩）、双语字幕（默认关闭）、智能换行（默认开启）

字幕支持 JSON3、SRV3、SRV1、WebVTT，翻译失败保留原字幕；频道屏蔽支持手动列表与每小时更新的远程列表。

## 验证边界

本地自动检查覆盖构建与脚本逻辑，
