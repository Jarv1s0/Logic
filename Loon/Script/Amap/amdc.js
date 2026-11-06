// AMDC 调度处理，改编自 ddgksf2013 的 amdc.js；来源及边界见 Loon/Docs/amap.md。
const headers = $request.headers || {};
const userAgent = headers["User-Agent"] || headers["user-agent"] || "";
const matched = /(AMap|Cainiao|%E9%97%B2%E9%B1%BC|%E9%A3%9E%E7%8C%AA%E6%97%85%E8%A1%8C|%E5%96%B5%E8%A1%97|%E5%A4%A9%E7%8C%AB|Alibaba|MovieApp|Hema4iPhone|Moon|DMPortal)/.test(userAgent);
$done(matched ? { body: "Jarvis" } : {});
