const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(process.env.AMAP_SCRIPT || path.join(__dirname, "../amap-new.js"), "utf8");
const url = "https://ai.amap.com/v1/ai_rec/home_qs";
function run(body, requestUrl = url) {
  let result;
  vm.runInNewContext(source, {
    $request: { url: requestUrl }, $response: { body },
    $done: value => { result = value.body; }, console: { log() {} }
  });
  return result;
}
function values(body) {
  return body.split(/\r?\n\r?\n/).flatMap(frame => {
    const lines = frame.split(/\r?\n/).filter(line => line.startsWith("data:"));
    return lines.length ? [JSON.parse(lines.map(line => line.slice(5).trimStart()).join("\n"))] : [];
  });
}
function taxiCards(value) {
  const template = value.component?.data?.data;
  return template?.template === "aiPmtGenerate"
    ? Object.values(template.modules || {}).filter(card => card?.card_id === "C2TaxiBizContainer" &&
      Array.isArray(card.data?.cardData?.dataList)) : [];
}
function verify(body) {
  const expected = values(body);
  let removed = 0;
  for (const value of expected) {
    for (const card of taxiCards(value)) {
      removed += card.data.cardData.dataList.length;
      card.data.cardData.dataList = [];
    }
  }
  assert.ok(removed > 0, "输入必须包含目的地打车推荐");
  const output = run(body);
  assert.deepEqual(values(output), expected, "只清空目标列表，其他字段及事件保持一致");
  assert.deepEqual(output.match(/^(?:event|id|:).*$/gm), body.match(/^(?:event|id|:).*$/gm));
  assert.equal(run(output), output, "重复处理保持一致");
}

const card = { card_id: "C2TaxiBizContainer", data: { cardData: {
  dataList: [{ biz: { button: { text: "去打车" } } }], uiSchemaMap: { test: {} }
} } };
const template = { template: "aiPmtGenerate", modules: {
  PmtContainer: card,
  frequent: { card_id: "NestCard", data: { props: { children: [
    { meta: { dy_card_id: "VO_KHYZDF9G_CARD_OC67DFOU" }, data: { entries: ["回家", "去单位"] } }
  ] } } },
  unknown: { card_id: "UnknownCard", data: { dataList: [1] } }
}, regions: { content: ["PmtContainer", "frequent", "unknown"] } };
const frame = (event, value) => `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
const start = frame("data", { seq: 1, component: { type: "container", data: { data: template } } });
const done = frame("data", { seq: 2, is_done: true, has_more: false,
  component: { type: "markdown", text: "", displayText: "" } });
const complete = frame("COMPLETE", {});
const stream = start + done + complete;
verify(stream);
verify(stream.replace(/\n/g, "\r\n"));
for (const body of [start, start + done, stream + frame("error", {}), stream + "event: data\ndata: invalid\n\n",
  stream.replaceAll("C2TaxiBizContainer", "UnknownTaxiContainer"),
  stream.replace('"dataList":[{', '"dataList":null,"unknownList":[{'),
  stream.replaceAll("aiPmtGenerate", "anotherTemplate")]) {
  assert.equal(run(body), body, "未知结构或异常流透传");
}
assert.equal(run(stream, "https://ai.amap.com/v1/ai_rec/other"), stream);
console.log("首页流回归通过：目标清理、常用地点及未知卡片保留、异常透传、重复处理。");

if (process.argv[2]) {
  const entries = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).log.entries;
  let count = 0;
  for (const entry of entries) {
    if (!/^https:\/\/ai\.amap\.com\/v1\/ai_rec\/home_qs(?:\?|$)/.test(entry.request.url)) continue;
    const content = entry.response.content;
    const body = content.encoding === "base64" ? Buffer.from(content.text, "base64").toString() : content.text;
    verify(body);
    count++;
  }
  assert.ok(count > 0, "HAR 必须包含首页响应");
  console.log(`真实 HAR 对照通过：${count} 条首页响应，仅目标推荐列表变化。`);
}
