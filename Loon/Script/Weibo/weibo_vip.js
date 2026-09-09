/**
 * @author fmz200
 * @function 解锁微博会员图标
 * @date 2024-06-13 09:20:00
 *
 * [MITM]
 * hostname = new.vip.weibo.cn
 *
 * 由 Loon/weibo.plugin 的 [Script] 规则加载，脚本地址固定为 master 分支。
 * https://raw.githubusercontent.com/Jarv1s0/Logic/master/Loon/Script/Weibo/weibo_vip.js
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
