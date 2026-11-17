# 好轻去广告

- 插件：[`Haoqing_remove_ads.lpx`](../Haoqing_remove_ads.lpx)，要求 Loon 3.5.1(998) 或更高，启用 MitM 并信任证书。
- [安装直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/Haoqing_remove_ads.lpx)。

## 处理范围

- 开屏：清空 `launchers`，关闭第三方广告开关并置零剩余次数
- 首页：移除抓包确认的商品推荐模块和商城推广
- 广告接口：清空轮播、横幅、商品流等广告位，广告统计返回成功
- 第三方广告：拒绝 `adx.anythinktech.com`、`apiv4.anythinktech.com`

Mock 规则仅匹配抓包确认的主机、路径和方法；保留账户、体重记录、运动、饮食、健康文章、商城交易和推送服务。
