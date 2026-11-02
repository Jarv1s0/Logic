/**
 * 航旅纵横
 * 来源：fmz200/wool_scripts Scripts/umetrip/umetrip_ads.js
 * 上游版本：4b7830670baf235ed945085cb926dc499cf619e0，GPL-3.0（见同目录 LICENSE）
 * 本地修改（2026-11-02）：缺失或非字符串 rpid 时透传，兼容请求头大小写。
 */
const version = 'V1.0.1';
const headers = $request.headers || {};
const key = Object.keys(headers).find(key => key.toLowerCase() === 'rpid');
const ua = typeof headers[key] === 'string' ? headers[key] : '';
ua.includes("1000002") || ua.includes("1000019") ? $done({status: "HTTP/1.1 404 Not Found"}) : $done({});
