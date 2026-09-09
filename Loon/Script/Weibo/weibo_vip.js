/**
 * @author fmz200
 * @function 解锁微博会员图标
 * @date 2024-06-13 09:20:00
 *
 * [MITM]
 * hostname = new.vip.weibo.cn
 *
 * [rewrite_local]
 * ^https?://new\.vip\.weibo\.cn/aj/appicon/list url script-response-body https://raw.githubusercontent.com/Jarv1s0/Logic/b3d8b9151703374f51b38ce101ddfc7812e9cf15/Loon/Script/Weibo/weibo_vip.js
 */

let body = $response.body;
let obj = JSON.parse(body);

if (obj.data?.list) {
  obj.data.list.forEach(function (item) {
    item.cardType = "2";
    item.tag = "";
  });
}

$done({body: JSON.stringify(obj)});
