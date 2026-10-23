# YouTube 插件

- 插件：[`YouTube.lpx`](../YouTube.lpx)，要求 Loon 3.5.1(983) 或更高版本，启用 MITM 并信任证书。
- [插件直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/YouTube.lpx)：在 Loon 中添加此插件地址。
- 原作者：devchristian1337；[上游插件](https://raw.githubusercontent.com/devchristian1337/loon-plugins/refs/heads/main/Plugins/YouTube.lpx)，[上游脚本目录](https://github.com/devchristian1337/loon-plugins/tree/main/Scripts/YouTube)。上游 README 标注 MIT License。
- 迁移日期：2026-10-23。两个配套脚本原样收录到 `Loon/Script/YouTube/`；插件改用本仓库脚本地址，中文化配置名称、说明和任务标签。参数键、选项值、默认值及处理规则保持上游行为。
- 播放地区和字幕语言的选项保留脚本要求的代码，中文含义见配置项说明。地区设置不改变出口 IP，无字幕视频无法翻译，画质研究不会自动切换画质。
- 日志及完整媒体采样默认关闭；完整采样可能增加延迟。关闭日志后，下次命中 API 会清除日志，需保留时先导出。
- 已做静态校验，未进行 Loon 真机验证，无法确认实际去广告、播放回退和后台播放效果。

抓取时 GitHub API 限流，未取得上游提交号；以下 SHA-256 记录实际收录的上游快照：

```text
Plugins/YouTube.lpx  f6aa0f49535954cd45cda6a20dc3a0a656ee203127a6bc374da2191a3779bc71
Scripts/YouTube/request.min.js  4e398c4aa063b91c54e8bff723379fc0923d6eef3ae45bbece49d469857cb16b
Scripts/YouTube/response.min.js  f7b40172c0ad3a53a7f61241e4516fdc6d27c83432f655dbc6ed0d4a4cb5f3eb
```
