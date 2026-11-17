# 航旅纵横去广告

- 插件：[`umetrip.plugin`](../umetrip.plugin)，启用脚本与 MITM 并信任证书。
- [安装直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/umetrip.plugin)。
- 当前版本 `20261105-1`，仅使用接口脚本，不再修改个人页资源包。

## 处理范围

- 首页、瀑布流、个人页、行程页的广告组与推广卡片过滤（按模板编号和 `ADVERT` 标记）
- 会员模块、会员权益页及会员素材屏蔽
- 行程页“会员送航延险”条幅、个人页会员卡等已确认推广
- 保留订单、证件、钱包、客服等正常模块，未知结构透传

## 来源与边界

最初提取自 [fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)，后合并 [xingjiu29/Umetrip](https://raw.githubusercontent.com/xingjiu29/Umetrip/refs/heads/main/umetrip.plugin) 的目标识别。使用 GPL-3.0，许可证见 [`LICENSE`](../Script/Umetrip/LICENSE)。

个人页资源包改写曾导致“我的”页面白屏，已撤回；目前不修改 `entry.js` 等资源，个人页空框与底部标志的无痕清理尚未完成。
