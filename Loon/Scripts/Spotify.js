const url = $request.url;
let body = $response.body;

if (url.includes("bootstrap/v1/bootstrap") || url.includes("user-v1/user")) {
    let obj = JSON.parse(body);
    // 基础状态修改
    obj.product = "premium";
    obj.type = "premium";
    // 补全 v9.1.14 版本强校验所需的嵌套对象
    if (obj.product_state) {
        obj.product_state.catalogue = "premium";
        obj.product_state.type = "premium";
        obj.product_state.name = "premium";
    }
    // 解锁功能控制位
    if (obj.features) {
        obj.features.is_premium = true;
        obj.features.can_download = true;
        obj.features.is_offline_mode_available = true;
        obj.features.can_stream_extreme = true;
    }
    body = JSON.stringify(obj);
}

if (url.includes("track-view/v1/queries")) {
    let obj = JSON.parse(body);
    // 注入搜索与列表页的 Premium 逻辑
    obj.is_premium = true;
    body = JSON.stringify(obj);
}

$done({ body });
