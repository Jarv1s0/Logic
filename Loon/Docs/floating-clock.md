# 悬浮时钟去广告

插件文件：[FloatingClock_remove_ads.lpx](../FloatingClock_remove_ads.lpx)。在 Loon 中本地导入并启用，无需 MitM 或证书，无配套脚本。

## 处理范围

依据用户提供的 HAR（399 条请求），拒绝以下广告服务主机：

- `s.tuia.cn`：抓包含 `/ad/request` 广告请求、SDK 初始化与广告跟踪。
- `tm.sigmob.cn`：抓包含 `/waterfall/v1`、`/strategy/v6` 等广告 SDK 请求。
- `sdk.1rtb.net`：抓包含 `/sdk/req_ad` 广告请求，原响应为 HTTP 404。

域名规则对其他 App 使用同一广告服务也生效，可能影响激励广告及依赖广告完成的流程；不伪造广告奖励或会员权益。广告响应含加密文本或二进制数据，因此不猜测其空响应格式。

保留 `hzjuzhi.com`、`config.hzjuzhi.com`、图片域名、反馈及会员商品接口。保留 `scheduled/featured/list`：抓包中该接口混有购物优惠和演出、赛事抢购提醒，现有证据不足以将整份列表认定为广告。`iOSVersionCtrl.agc`、`timeSource.agc` 在抓包中均返回 304，无正文，未尝试改写其内容。腾讯相关请求仅见 IP 查询、统计及素材，不据此扩大拦截范围。

## 验证边界

已使用 HAR 核对主机命中和业务接口保留范围；未进行 Loon 真机验证，无法确认全部广告消失、广告占位折叠、SDK 失败重试或本地缓存行为。启用后彻底退出并重新打开悬浮时钟，在设备上检查广告与计时、提醒功能。

HAR 仅用于本地分析，不纳入仓库，也不保存其中的账号、请求签名或设备标识。
