# 好轻去广告

插件文件：[Haoqing_remove_ads.lpx](../Haoqing_remove_ads.lpx)。使用 Loon 新版 `[Rewrite]` DSL，最低版本设为 `3.5.1(998)`；启用插件和 MitM，并安装及信任证书。该版本号表示本插件要求，不表示已核实的最新发行版本。

本地导入 `.lpx` 即可使用，无配套脚本或远程资源依赖。文件发布到仓库后，也可通过 `https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/Haoqing_remove_ads.lpx` 安装；仅本地新增时此地址尚不可用。

## 处理范围

- 开屏：清空 `launchers`，关闭 `thirdPartyAd.switchOn`；关闭广告次数配置的 `switchOn` 并将 `remainingTimes` 置零。
- 专用广告接口：返回结构匹配的空轮播、横幅、商品流、单位置广告、社区广告和悬浮推广；广告统计直接返回成功。
- 多位置广告：保留位置对象，清空各位置的 `ads`。
- 首页：移除抓包确认的商品推荐模块 `moduleType=210`；仅移除 tips 中 `schema` 以 `haoqing://youzan?` 开头的商城推广，保留健康文章。
- 第三方广告：拒绝抓包确认的 `adx.anythinktech.com` 和 `apiv4.anythinktech.com`，这两条域名规则也可能影响其他 App 使用同一广告 SDK。

Mock 规则仅匹配抓包中确认的 HTTPS 主机、完整路径和请求方法。混合响应仅在 HTTP 200、业务 `result.code=0` 且目标字段为数组时修改。未拦截账户、设备、体重记录、运动、饮食、健康文章、商城交易、推送服务或整个图片域名。

## 来源与验证边界

依据用户提供的 HAR（334 条请求）编写；HAR 仅在本地分析，不纳入仓库，不保存其中的账号、签名、设备标识及健康数据。

语法依据（2026-11-02 在线核对）：[Loon 官方 Rewrite 文档](https://nsloon.app/docs/Rewrite/rewrite_v2)、[插件文档](https://nsloon.app/docs/Plugin/)。使用 `response.body.mock("json", ..., 200)` 在请求发往上游前生成响应，使用 `response.json.jq(...)` 精确过滤混合数据。

回放命令：`python scripts/test-haoqing.py <HAR路径> <jq可执行文件路径>`。回放验证配置的正则、方法、MitM 覆盖、Mock JSON 和内联 JQ，对混合接口检查保留字段，并检查错误响应不被改写。回放不能代替 Loon 解析器或真机运行。

未进行 Loon 真机验证；无法确认 App 本地缓存广告、未出现在 HAR 中的广告位或未来接口变化的效果。导入后重新启动好轻，检查开屏、首页、社区及体重记录；广告空位是否折叠由 App 决定。
