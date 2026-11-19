import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const directory = new URL("../", import.meta.url);
const plugin = readFileSync(new URL("../../../Spotify.lpx", import.meta.url), "utf8");
const script = new vm.Script(readFileSync(new URL("spot-proto.js", directory), "utf8"));

// Use the archived protobufjs schema as an independent wire-format oracle.
// The new script itself has no protobufjs or Node dependency.
const schemaContext = vm.createContext({
  Uint8Array, ArrayBuffer,
  $response: { status: 204 }, $done() {}, console: { log() {} },
});
vm.runInContext(readFileSync(new URL("spot-proto-eevee.js", directory), "utf8"), schemaContext);
const root = vm.runInContext("protobuf.Root.fromJSON(spotifyJson)", schemaContext);
const configurationType = root.lookupType("Configuration");
const attributesType = root.lookupType("AccountAttributesResponse");
const customizeType = root.lookupType("UcsResponseWrapper");
const bootstrapType = root.lookupType("BootstrapResponse");
const resolveType = root.lookupType("ResolveResponse");
const encode = (type, value) => Uint8Array.from(type.encode(type.fromObject(value)).finish());
const decode = (type, bytes) => JSON.parse(JSON.stringify(type.toObject(type.decode(bytes), { longs: String })));
const host = "https://spclient.wg.spotify.com";
const configurationPath = "/remote-config-resolver/v3/configuration";
const attributesPath = "/nebula/v1/configuration/attributes";
const frozenTime = Date.UTC(2026, 10, 19, 2, 3, 4);
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [frozenTime])); }
  static now() { return frozenTime; }
}

function run(body, options = {}) {
  const calls = [];
  const logs = [];
  const context = vm.createContext({
    Uint8Array, ArrayBuffer, Date: FixedDate,
    $request: {
      url: host + (options.path ?? configurationPath), method: options.method ?? "POST",
      headers: options.requestHeaders ?? { "User-Agent": "Spotify/9.1.98 iOS/18.0" },
    },
    $response: { status: options.status ?? 200, body, headers: options.headers ?? {} },
    $done(value) { calls.push(value); },
    console: { log(value) { logs.push(value); } },
  });
  if (options.qx) {
    context.$task = {};
    context.$response.bodyBytes = body;
    delete context.$response.body;
  }
  script.runInContext(context, { timeout: 3000 });
  assert.equal(calls.length, 1, "each intercepted response must complete exactly once");
  return { output: calls[0], logs };
}

function flag(scope, name, value, kind = "boolValue") {
  return { propertyId: { scope, name }, [kind]: { value } };
}

function configuration(values = [flag("core-ads", "music_adt_enabled", true)]) {
  return {
    configurationAssignmentId: "server-assignment", fetchTimeMillis: "1000",
    policySnapshotId: "42", assignedValues: values,
  };
}

function attributes(extra = {}) {
  return {
    accountAttributes: {
      type: { stringValue: "free" }, ads: { boolValue: true }, ...extra,
    },
  };
}

function customization(config = configuration(), account = attributes()) {
  return {
    success: {
      resolveSuccess: { configuration: config }, accountAttributesSuccess: account,
    },
  };
}

function findFlag(config, scope, name) {
  return config.assignedValues.find((entry) => entry.propertyId.scope === scope && entry.propertyId.name === name);
}

function passedThrough(result) {
  assert.deepEqual(Object.keys(result.output), []);
}

test("shipped Loon rules cover four endpoints, query strings and regional hosts", () => {
  const lines = plugin.split(/\r?\n/);
  const scriptLines = lines.filter((line) => line.startsWith("response ") && line.includes("spot-proto.js"));
  const cacheLine = lines.find((line) => line.includes('request.header.del("if-none-match")'));
  const patterns = [...scriptLines, cacheLine].map((line) => {
    const match = /~= \/(.*)\/([a-z]*) then/.exec(line);
    assert.ok(match, line);
    return new RegExp(match[1], match[2]);
  });
  assert.equal(scriptLines.length, 1);
  assert.doesNotMatch(plugin, /\[Argument\]|spot-ev[13]-enable/);
  assert.match(scriptLines[0], /script\("[^"]+"\) with/);
  assert.doesNotMatch(scriptLines[0], /enable=/);
  for (const path of ["/bootstrap/v1/bootstrap", "/user-customization-service/v1/customize", configurationPath, attributesPath]) {
    for (const origin of [host, "https://gew1-spclient.spotify.com:443", "https://ap-southeast-1-spclient.spotify.com"]) {
      for (const pattern of patterns) assert.ok(pattern.test(origin + path + "?market=US"));
    }
  }
  for (const pattern of patterns) {
    assert.equal(pattern.test(host + attributesPath + "/other"), false);
    assert.equal(pattern.test("https://spclient.wg.spotify.com.evil.example" + configurationPath), false);
  }
  for (const line of scriptLines) {
    const url = /script\("([^"]+)"/.exec(line)[1];
    const localPath = fileURLToPath(new URL("../../../" + url.split("/Loon/")[1], import.meta.url));
    assert.ok(readFileSync(localPath).length > 0, "shipped script URL must resolve to a local artifact");
    assert.match(line, /requires_body=true, binary_body_mode=true/);
  }
});

test("artist and album rewrites preserve identifiers and query parameters", () => {
  const line = plugin.split(/\r?\n/).find((line) => line.includes(" as view then"));
  const match = /~= \/(.*)\/ as view then url.replace\("([^"]+)"\)/.exec(line);
  const pattern = new RegExp(match[1]);
  for (const path of ["artistview/v1/artist/id", "album-entity-view/v2/album/id"]) {
    const input = `https://ap-southeast-1-spclient.spotify.com:443/${path}?market=US&platform=iphone&locale=zh`;
    const captures = pattern.exec(input);
    assert.ok(captures);
    const output = match[2].replace(/\$\{view\.(\d+)\}/g, (_, index) => captures[index]);
    assert.equal(output, `${host}/${path}?market=US&platform=ipad&locale=zh`);
    assert.equal(pattern.test(`${host}/${path}?platform=ipad`), false);
  }
});

test("new raw configuration endpoint applies the fixed snapshot", () => {
  const result = run(encode(configurationType, configuration()));
  const output = decode(configurationType, result.output.body);
  assert.match(output.configurationAssignmentId, /^1bf92045/);
  assert.ok(output.assignedValues.length > 800);
});

test("new wrapped configuration endpoint retains its ResolveResponse envelope", () => {
  const input = encode(resolveType, { configuration: configuration() });
  const result = run(input);
  const output = decode(resolveType, result.output.body).configuration;
  assert.match(output.configurationAssignmentId, /^1bf92045/);
  assert.ok(output.assignedValues.length > 800);
});

test("fixed snapshot does not require client version headers", () => {
  const body = encode(configurationType, configuration());
  const unknown = decode(configurationType, run(body, { requestHeaders: {} }).output.body);
  const identified = decode(configurationType, run(body).output.body);
  assert.deepEqual(unknown, identified);
  assert.equal(unknown.configurationAssignmentId, "1bf92045-dc28-0fd6-41b4-f465a2707f7f:2713372");
});

test("snapshots retain live assignments and discard unrelated server flags", () => {
  const input = configuration([
    flag("ios-campfire-properties-impl", "campfire_feature_enabled", false),
    flag("ios-feature-sidedrawer-platform", "is_list_page_enabled", true),
    flag("normal-feature", "server_only", true),
  ]);
  const output = decode(configurationType, run(encode(configurationType, input)).output.body);
  assert.equal(findFlag(output, "ios-campfire-properties-impl", "campfire_feature_enabled").boolValue.value, false);
  assert.equal(findFlag(output, "ios-feature-sidedrawer-platform", "is_list_page_enabled").boolValue.value, true);
  assert.equal(findFlag(output, "normal-feature", "server_only"), undefined);
});

test("new account attribute endpoint patches a GET response", () => {
  const input = attributes({
    "on-demand-trial": { boolValue: true }, "is-premium-eligible-v100": { boolValue: true },
    "normal-attribute": { stringValue: "keep" },
  });
  const result = run(encode(attributesType, input), { path: attributesPath, method: "GET" });
  const output = decode(attributesType, result.output.body).accountAttributes;
  assert.equal(output.type.stringValue, "premium");
  assert.equal(output.ads.boolValue, false);
  assert.equal(output["on-demand"].boolValue, true);
  assert.equal(output["normal-attribute"].stringValue, "keep");
  assert.equal(output["on-demand-trial"], undefined);
  assert.equal(output["is-premium-eligible-v100"], undefined);
  assert.equal(output["subscription-enddate"].stringValue, "2027-11-19T02:03:04Z");
});

test("server download, quality and Jam attributes retain their original values", () => {
  const server = {
    offline: { boolValue: false }, "can-use-offline": { boolValue: false },
    "has-offline-state": { boolValue: true }, "max-offline-downloads-per-device": { longValue: "7" },
    "max-offline-tracks": { longValue: "500" }, "offline-backup": { boolValue: false },
    "lyrics-offline": { boolValue: true }, "very-high-bitrate": { boolValue: false },
    "audio-quality": { stringValue: "server-quality" }, "social-session": { boolValue: false },
    "social-session-free-tier": { boolValue: true }, "jam-social-session": { stringValue: "server-jam" },
  };
  const expected = decode(attributesType, encode(attributesType, attributes(server))).accountAttributes;
  const result = run(encode(attributesType, attributes(server)), { path: attributesPath });
  const output = decode(attributesType, result.output.body).accountAttributes;
  for (const key of Object.keys(server)) assert.deepEqual(output[key], expected[key], key);
  const missing = decode(attributesType, run(encode(attributesType, attributes()), { path: attributesPath }).output.body).accountAttributes;
  for (const key of Object.keys(server)) assert.equal(missing[key], undefined, `${key} must not be fabricated`);
});

test("legacy customize and bootstrap still work without configuration arguments", () => {
    const data = customization();
    const customize = run(encode(customizeType, data), { path: "/user-customization-service/v1/customize?market=US" });
    const patched = decode(customizeType, customize.output.body).success;
    assert.equal(patched.accountAttributesSuccess.accountAttributes.type.stringValue, "premium");
    const bootstrap = {
      ucsResponseV0: { success: { customization: data } },
      trialsFacadeResponseV1: { success: { field1: 1 } },
    };
    const result = run(encode(bootstrapType, bootstrap), { path: "/bootstrap/v1/bootstrap" });
    const output = decode(bootstrapType, result.output.body);
    assert.equal(output.trialsFacadeResponseV1, undefined);
    assert.equal(output.ucsResponseV0.success.customization.success.accountAttributesSuccess.accountAttributes.ads.boolValue, false);
});

test("error envelopes and unsupported methods pass through unchanged", () => {
  const error = encode(customizeType, { error: { errorCode: 3, errorMessage: "unavailable" } });
  passedThrough(run(error, { path: "/user-customization-service/v1/customize" }));
  const bootstrap = encode(bootstrapType, { trialsFacadeResponseV1: { success: { field1: 1 } } });
  passedThrough(run(bootstrap, { path: "/bootstrap/v1/bootstrap" }));
  passedThrough(run(encode(configurationType, configuration()), { method: "GET" }));
  passedThrough(run(error, { path: "/unrelated" }));
  passedThrough(run(error, { path: configurationPath + "/other" }));
});

test("legacy envelopes cannot hide an unrecognized configuration or attribute payload", () => {
  const unknownConfig = encode(customizeType, customization({ configurationAssignmentId: "unknown" }));
  const unknownAttributes = encode(customizeType, customization(configuration(), { accountAttributes: {} }));
  for (const body of [unknownConfig, unknownAttributes]) {
    passedThrough(run(body, { path: "/user-customization-service/v1/customize" }));
  }
});

test("non-200 responses, empty bodies and text bodies pass through unchanged", () => {
  for (const status of [204, 304, 403, 500]) passedThrough(run(new Uint8Array([0x80]), { status }));
  passedThrough(run(new Uint8Array()));
  passedThrough(run("not protobuf"));
  passedThrough(run(undefined));
});

test("malformed or unrelated protobuf cannot be overwritten by a snapshot", () => {
  for (const body of [
    [0x80], [0x0a, 0x05, 0x01], [0x00], [0x0f], [0x1a, 0x01, 0x00],
    [0x08, ...new Array(10).fill(0xff), 0x01], [0x0c],
    [0x80, 0x80, 0x80, 0x80, 0x10, 0x00],
  ]) {
    passedThrough(run(Uint8Array.from(body)));
    passedThrough(run(Uint8Array.from(body), { path: attributesPath }));
  }
});

test("binary body views, ArrayBuffers, arrays and QX bodyBytes retain byte boundaries", () => {
  const input = encode(configurationType, configuration());
  const backing = new Uint8Array(input.length + 8).fill(0xff);
  backing.set(input, 4);
  for (const body of [backing.subarray(4, 4 + input.length), input.buffer, Array.from(input)]) {
    const output = run(body).output;
    assert.ok(output.body instanceof Uint8Array);
    assert.match(decode(configurationType, output.body).configurationAssignmentId, /^1bf92045/);
  }
  const qx = run(input.buffer, { qx: true }).output;
  assert.ok(qx.bodyBytes instanceof ArrayBuffer);
  assert.match(decode(configurationType, new Uint8Array(qx.bodyBytes)).configurationAssignmentId, /^1bf92045/);
});

test("rewritten binary responses discard stale length and encoding headers", () => {
  const result = run(encode(configurationType, configuration()), {
    headers: { "Content-Length": "10", "content-encoding": "gzip", "Content-Type": "application/x-protobuf", etag: "server-etag" },
  });
  assert.deepEqual({ ...result.output.headers }, { "Content-Type": "application/x-protobuf", etag: "server-etag" });
});

test("unknown config fields and untouched assignment bytes survive patching", () => {
  const unknown = Uint8Array.from([0xa2, 0x06, 0x03, 0x66, 0x6f, 0x6f]); // field 100 = "foo"
  const config = encode(configurationType, configuration([flag("normal-feature", "keep_enabled", true)]));
  const input = Uint8Array.from([...config, ...unknown]);
  const output = run(input).output.body;
  assert.ok(Buffer.from(output).includes(unknown), "future root fields must remain intact");
  // policyId = 2^53 + 1, encoded directly because the archived schema has no Long runtime.
  const rawMetadata = [0x12, 0x09, 0x08, 0x81, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x10];
  const entry = Uint8Array.from([
    ...encode(root.lookupType("AssignedValue"), flag("ios-campfire-properties-impl", "campfire_feature_enabled", true)), ...rawMetadata,
  ]);
  assert.ok(entry.length < 128);
  const encoded = Uint8Array.from([0x1a, entry.length, ...entry]);
  const result = run(encoded);
  assert.ok(Buffer.from(result.output.body).includes(entry), "int64 metadata must not lose precision");
});

test("fixed snapshot applies ad and upsell rules", () => {
  const output = decode(configurationType, run(encode(configurationType, configuration())).output.body);
  assert.equal(findFlag(output, "ios-feature-shuffletoggleupsell", "is_enabled_pt2").boolValue.value, false);
  assert.equal(findFlag(output, "ios-feature-lyrics", "enable_lyrics_share").boolValue.value, true);
});
