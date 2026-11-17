# 高德地图净化

- 插件：[`Amap_remove_ads.lpx`](../Amap_remove_ads.lpx)，启用 HTTPS 解密并信任证书。
- [安装直链](https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/Amap_remove_ads.lpx)。

## 处理范围

- 首页 SSE 信息流：清理瀑布广告、续导航、目的地打车等已识别推荐
- 房产、地点详情：移除推广模块与入口，保留餐饮、酒店等正常货架
- 通勤/打车、搜索结果、“我的”页面：按已确认字段清理，保留正常功能
- AMDC 调度：按上游条件处理 `amdc.m.taobao.com` 响应

只处理已确认的字段和模板，未知结构与异常响应透传。


## 验证

```powershell
node --check Loon/Script/Amap/amap-new.js
node Loon/Script/Amap/tests/home-stream.cjs
```

未进行真机验证，缓存可能使旧广告继续显示。
