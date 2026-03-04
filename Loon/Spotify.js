const url = $request.url;
let body = $response.body;

if (url.includes("bootstrap/v1/bootstrap") || url.includes("user-v1/user")) {
    let obj = JSON.parse(body);
    // 基础权限注入
    obj.product = "premium";
    obj.type = "premium";
    // 补全最新版校验所需的子字段
    if (obj.product_state) {
        obj.product_state.catalogue = "premium";
        obj.product_state.type = "premium";
        obj.product_state.name = "premium";
    }
    // 激活功能特性
    if (obj.features) {
        obj.features.is_premium = true;
        obj.features.can_download = true;
        obj.features.is_offline_mode_available = true;
    }
    body = JSON.stringify(obj);
}

if (url.includes("track-view/v1/queries")) {
    let obj = JSON.parse(body);
    // 针对搜索和播放列表视图的 Premium 注入
    obj.is_premium = true;
    body = JSON.stringify(obj);
}

$done({ body });
