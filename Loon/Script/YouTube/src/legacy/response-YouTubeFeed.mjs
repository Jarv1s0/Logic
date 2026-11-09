// devchristian1337; extracted from the previously vendored bundle. See SOURCE.md.
import { ytRuntimeInvoke } from "../legacy-runtime.mjs";
function YouTubeFeed(e, r) {
  return ytRuntimeInvoke(function(e2, r2, t, n, a) {
    var i = Date.now();
    var o = null;
    try {
      var s = typeof $script !== "undefined" && $script ? $script.startTime : null;
      var u = s && typeof s.getTime === "function" ? s.getTime() : null;
      if (typeof u === "number" && Number.isFinite(u) && u >= 0 && u <= i) o = u;
    } catch (e3) {
    }
    function ytDiagnosticStampTiming(e3) {
      var r3 = Date.now(), t2 = e3.timing && typeof e3.timing === "object" && !Array.isArray(e3.timing) ? e3.timing : {};
      var n2 = r3 - i;
      if (Number.isFinite(n2) && n2 >= 0 && n2 <= 6e5) t2.jsBeforeIndexCommitMs = n2;
      if (o !== null) {
        var a2 = r3 - o;
        if (Number.isFinite(a2) && a2 >= 0 && a2 <= 6e5) t2.runtimeBeforeIndexCommitMs = a2;
      }
      if (Object.keys(t2).length) e3.timing = t2;
    }
    function ytDiagnosticShouldRecord(e3, r3, t2) {
      var n2 = r3 && r3.processing;
      var a2 = e3.level === "error" || !!(r3 && r3.responseBefore && Number(r3.responseBefore.status) >= 400 && Number(r3.responseBefore.status) <= 599) || !!(n2 && n2.exception) || /inner=(?:authentication_failed|compression_failed|invalid_config_key|protocol_cleanup_failed)/.test(e3.message);
      if (a2) e3.level = "error";
      if (t2 === "error") return a2;
      if (t2 === "warn") return a2 || e3.level === "warn";
      if (t2 !== "debug" && e3.level === "debug") e3.level = "info";
      return true;
    }
    function ytDiagnosticCommitEntry(e3, r3) {
      var t2 = "ytads.logger.config.v1", a2 = "ytads.logger.entries.v2";
      var i2 = JSON.parse(n.read(t2) || "null");
      if (!i2 || !i2.enabled || i2.session !== e3.session) throw Error("log-session-inactive");
      var o2 = n.read(a2);
      if (o2 && o2.length > 131072) throw Error("log-index-invalid");
      var s2 = o2 ? JSON.parse(o2) : null;
      var u2 = s2 && s2.session === e3.session && Array.isArray(s2.entries) ? s2 : { session: e3.session, entries: [], captureBytes: 0 };
      var l = e3.entries[e3.entries.length - 1];
      var f = l.captureRef ? l.captureRef.storedBytes : 0;
      var d = Number(u2.captureBytes || 0);
      if (!Number.isFinite(d) || d < 0 || !Number.isFinite(f) || f < 0) throw Error("log-index-invalid");
      var c = u2.entries.length >= 600 ? "entry-limit" : d + f > r3 ? "capture-budget-limit" : null;
      ytDiagnosticStampTiming(l);
      var p = JSON.stringify({ session: e3.session, entries: u2.entries.concat([l]), captureBytes: d + f });
      if (!c && unescape(encodeURIComponent(p)).length > 131072) c = "log-index-limit";
      if (c) {
        i2.enabled = false;
        i2.haltReason = c;
        i2.haltedAt = (/* @__PURE__ */ new Date()).toISOString();
        if (n.write(JSON.stringify(i2), t2) !== true) throw Error("log-stop-write-failed");
        throw Error(c);
      }
      if (n.write(p, a2) !== true) throw Error("log-index-write-failed");
      return true;
    }
    function ytDiagnosticPurgeLegacy() {
      if (typeof n === "undefined") return;
      var e3 = "ytads.logger.privacy.v1";
      if (n.read(e3) === "structure-only-v1") return;
      var r3 = n.read("ytads.logger.entries.v2"), t2 = r3 ? JSON.parse(r3) : null;
      if (t2 && Array.isArray(t2.entries)) {
        for (var a2 = 0; a2 < t2.entries.length; a2++) {
          var i2 = t2.entries[a2], o2 = i2 && i2.captureRef;
          if (!o2) continue;
          if (typeof o2.prefix !== "string" || !/^ytads\.capture\.[a-z0-9-]+\.[a-z0-9-]+\.$/.test(o2.prefix) || !Number.isInteger(o2.chunks) || o2.chunks < 1 || o2.chunks > 256) throw Error("privacy-invalid-reference");
          for (var s2 = 0; s2 < o2.chunks; s2++) if (n.write(void 0, o2.prefix + s2) !== true) throw Error("privacy-delete-failed");
          delete i2.captureRef;
          i2.message = "legacy capture removed for privacy";
        }
        t2.captureBytes = 0;
        if (n.write(JSON.stringify(t2), "ytads.logger.entries.v2") !== true) throw Error("privacy-index-failed");
      }
      if (n.write("structure-only-v1", e3) !== true) throw Error("privacy-marker-failed");
    }
    function ytDiagnosticSanitize(e3) {
      if (!e3) return e3;
      var r3 = /(?:[a-z_]+\.eml-fe\|[0-9a-f]{16}|skip_ad_on_block|googleadservices\.com\/pagead\/|youtube\.com\/pagead\/|yt-ads-web-view-id|FEwhat_to_watch|FEsubscriptions|FEshorts)/g;
      function labels(e4) {
        return (String(e4).match(r3) || []).map(function(e5) {
          return e5.replace(/\|[0-9a-f]{16}$/, "|0000000000000000");
        });
      }
      function url(e4) {
        var r4 = /^(https?:\/\/[^/?#]+)(\/[^?#]*)?/.exec(String(e4 || ""));
        return r4 ? r4[1] + (r4[2] || "/") : "[removed]";
      }
      function headers(e4) {
        var r4 = {};
        Object.keys(e4 || {}).forEach(function(t3) {
          var n2 = String(e4[t3]);
          if (/^(content-type|content-length|content-encoding|accept-encoding)$/i.test(t3) && /^[a-z0-9\s/.,;+_=\-]{0,160}$/i.test(n2) || /^transfer-encoding$/i.test(t3) && /^(?:chunked|gzip|deflate|br|identity)(?:,\s*(?:chunked|gzip|deflate|br|identity))*$/i.test(n2) || /^accept-ranges$/i.test(t3) && /^(?:bytes|none)$/i.test(n2) || /^content-range$/i.test(t3) && /^bytes (?:\d+-\d+|\*)\/(?:\d+|\*)$/.test(n2)) r4[t3] = n2;
        });
        return r4;
      }
      function decode(e4) {
        var r4 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", t3 = [], n2 = 0, a2 = 0;
        for (var i2 = 0; i2 < e4.length && e4[i2] !== "="; i2++) {
          var o2 = r4.indexOf(e4[i2]);
          if (o2 < 0) throw Error("base64");
          n2 = n2 << 6 | o2;
          a2 += 6;
          if (a2 >= 8) {
            a2 -= 8;
            t3.push(n2 >>> a2 & 255);
          }
        }
        return new Uint8Array(t3);
      }
      var t2 = 0;
      function proto(e4, r4) {
        if (r4 > 32 || t2 > 3e4) return { bytes: e4.length, omitted: true };
        var n2 = 0, a2 = [];
        function integer() {
          var r5 = 0, t3 = 1;
          for (var a3 = 0; a3 < 10 && n2 < e4.length; a3++) {
            var i3 = e4[n2++];
            r5 += (i3 & 127) * t3;
            if (i3 < 128) return r5;
            t3 *= 128;
          }
          throw Error("varint");
        }
        while (n2 < e4.length) {
          if (++t2 > 3e4) throw Error("limit");
          var i2 = integer(), o2 = Math.floor(i2 / 8), s2 = i2 % 8;
          if (!o2) throw Error("tag");
          var u2 = { field: o2, wire: s2 };
          if (s2 === 0) {
            var l = integer();
            u2.value = l === 0 || l === 1 ? l : "[removed]";
          } else if (s2 === 1 || s2 === 5) {
            var f = s2 === 1 ? 8 : 4;
            n2 += f;
            u2.bytes = f;
          } else if (s2 === 2) {
            var d = integer();
            if (!Number.isSafeInteger(d) || d < 0 || d > e4.length - n2) throw Error("length");
            var c = e4.subarray(n2, n2 + d);
            n2 += d;
            u2.bytes = d;
            try {
              u2.fields = proto(c, r4 + 1);
            } catch (e5) {
              var p = "";
              for (var v = 0; v < c.length; v++) p += c[v] >= 32 && c[v] < 127 ? String.fromCharCode(c[v]) : " ";
              u2.markers = labels(p);
            }
          } else throw Error("wire");
          if (n2 > e4.length) throw Error("truncated");
          a2.push(u2);
        }
        return a2;
      }
      function json(e4, r4) {
        if (r4 > 32) return "[omitted]";
        if (typeof e4 === "string") return { chars: e4.length, markers: labels(e4) };
        if (typeof e4 === "number") return e4 === 0 || e4 === 1 ? e4 : "[removed]";
        if (Array.isArray(e4)) return e4.map(function(e5) {
          return json(e5, r4 + 1);
        });
        if (e4 && typeof e4 === "object") {
          var t3 = {};
          Object.keys(e4).forEach(function(n2) {
            if (!/token|cookie|auth|visitor|account|signature|clientkey|encryptkey|trackingparams|clicktracking/i.test(n2) && /^[a-zA-Z_][a-zA-Z0-9_]{0,80}$/.test(n2)) t3[n2] = json(e4[n2], r4 + 1);
          });
          return t3;
        }
        return e4;
      }
      function body(r4, t3, n2) {
        if (!r4 || r4.reference || !r4.available) return r4;
        var a2 = { available: false, reason: "privacy-structure-only", bytes: r4.bytes, redacted: true };
        if (!n2 && /^(config|log_event|initplayback|ump)$/.test(e3.endpoint)) return a2;
        try {
          var i2 = r4.memoryBytes instanceof Uint8Array ? r4.memoryBytes : r4.encoding === "base64" ? decode(r4.data) : null;
          if (i2) {
            try {
              var o2 = typeof TextDecoder === "function" && (i2[0] === 123 || i2[0] === 91) ? new TextDecoder("utf-8", { fatal: true }).decode(i2) : null;
              a2.structure = o2 ? json(JSON.parse(o2), 0) : proto(i2, 0);
            } catch (e4) {
              a2.structure = { bytes: i2.length, omitted: true };
            }
          } else a2.structure = json(JSON.parse(r4.data), 0);
        } catch (e4) {
          a2.structure = { omitted: true };
        }
        return a2;
      }
      ["request", "requestAfter", "requestInner", "requestInnerAfter", "responseBefore", "responseAfter"].forEach(function(r4) {
        var t3 = e3[r4];
        if (!t3) return;
        var n2 = {};
        ["status", "method", "synthetic", "changed", "transportHeadersRecomputedByLoon"].forEach(function(e4) {
          if (t3[e4] !== void 0) n2[e4] = t3[e4];
        });
        if (t3.url) n2.url = url(t3.url);
        if (t3.headers) n2.headers = headers(t3.headers);
        if (t3.headerOverrides) n2.headerOverrides = headers(t3.headerOverrides);
        n2.body = body(t3.body, r4 === "request" || r4 === "requestAfter", r4 === "requestInner" || r4 === "requestInnerAfter");
        e3[r4] = n2;
      });
      if (e3.processing && e3.processing.exception) e3.processing.exception = { code: "processing-failed" };
      e3.privacy = "structure-only-v1";
      return e3;
    }
    (function() {
      "use strict";
      var i2 = typeof e2 !== "undefined" ? String(e2.url || "") : "";
      var o2 = typeof r2 !== "undefined";
      if (o2 && /\/youtubei\/v1\/(?:browse|next|search)(?:\?[^#]*)?$/i.test(i2)) {
        (function() {
          "use strict";
          var i3 = "2.7.1";
          var o3 = 3e4;
          var s2 = 4 * 1024 * 1024;
          var u2 = 2e4;
          var l = typeof t === "object" && t ? t : {};
          l.log_level = String(l.log_level || "info").toLowerCase();
          if (typeof l.capture_raw === "undefined") l.capture_raw = l.log_enabled;
          var f = l.script_debug === true || l.script_debug === "true";
          var d = l.hide_home_shorts === true || l.hide_home_shorts === "true";
          var c = l.adaptive_feed_ads !== false && l.adaptive_feed_ads !== "false";
          var p = loadChannelBlocklist();
          var v = !!(p && Object.keys(p.ids).length);
          var g = !!(p && Object.keys(p.handles).length);
          var h = !!(p && Object.keys(p.names).length);
          var y = v || g;
          var m = { fields: 0 };
          var b = null;
          var w = "unknown";
          var S = /^https:\/\/(?:youtubei(?:-att)?\.googleapis\.com|(?:www\.|m\.|music\.)?youtube\.com)\/youtubei\/v1\/(browse|next|search)(?:\?[^#]*)?$/i;
          var k = [];
          var x = null;
          function devFailure(e3) {
            if (!devFlag(l.capture_raw)) return;
            try {
              x = { name: String(e3.name || "Error"), message: String(e3.message || ""), stack: typeof e3.stack === "string" ? e3.stack : null, code: e3.ytNoAdsCode || null };
            } catch (e4) {
            }
          }
          var _ = Date.now();
          function devFlag(e3) {
            return e3 === true || e3 === "true";
          }
          function devConfig() {
            if (!devFlag(l.log_enabled) || typeof n === "undefined") return null;
            var e3 = n.read("ytads.logger.config.v1");
            var r3 = e3 && e3.length <= 2048 ? JSON.parse(e3) : null;
            return r3 && r3.enabled === true && typeof r3.session === "string" && /^[a-z0-9-]{1,80}$/.test(r3.session) ? r3 : null;
          }
          function devUTF8Size(e3) {
            var r3 = 0;
            for (var t2 = 0; t2 < e3.length; t2++) {
              var n2 = e3.charCodeAt(t2);
              if (n2 < 128) r3++;
              else if (n2 < 2048) r3 += 2;
              else if (n2 >= 55296 && n2 <= 56319 && t2 + 1 < e3.length && e3.charCodeAt(t2 + 1) >= 56320 && e3.charCodeAt(t2 + 1) <= 57343) {
                r3 += 4;
                t2++;
              } else r3 += 3;
            }
            return r3;
          }
          function devBody(e3) {
            if (e3 === void 0 || e3 === null) return { available: false, reason: "not-provided-by-runtime" };
            if (typeof e3 === "string") {
              var r3 = devUTF8Size(e3);
              if (r3 > 8388608) throw new Error("capture-body-limit");
              return { available: true, encoding: "utf8-text", bytes: r3, data: e3 };
            }
            var t2;
            if (e3 instanceof Uint8Array) t2 = e3;
            else if (e3 instanceof ArrayBuffer) t2 = new Uint8Array(e3);
            else if (ArrayBuffer.isView(e3)) t2 = new Uint8Array(e3.buffer, e3.byteOffset, e3.byteLength);
            else return { available: false, reason: "unsupported-runtime-body-type" };
            if (t2.length > 8388608) throw new Error("capture-body-limit");
            return { available: true, bytes: t2.length, memoryBytes: t2 };
          }
          function devHalt(e3, r3) {
            if (e3) {
              var t2 = JSON.parse(n.read("ytads.logger.config.v1") || "null");
              if (!t2 || !t2.enabled || t2.session !== e3.session) return;
              e3.enabled = false;
              e3.haltReason = r3;
              e3.haltedAt = (/* @__PURE__ */ new Date()).toISOString();
              n.write(JSON.stringify(e3), "ytads.logger.config.v1");
            }
            if (typeof console !== "undefined") console.log("[YouTubeLogger] recording-stopped: " + r3);
          }
          function devAppend(e3, r3) {
            var t2 = Date.now();
            var a2 = [], i4 = null;
            try {
              i4 = devConfig();
              if (!i4) return false;
              if (!ytDiagnosticShouldRecord(e3, r3, l.log_level)) return true;
              ytDiagnosticPurgeLegacy();
              var o4 = n.read("ytads.logger.entries.v2");
              if (o4 && devUTF8Size(o4) > 131072) throw new Error("log-index-invalid");
              var s3 = o4 ? JSON.parse(o4) : null;
              var u3 = s3 && s3.session === i4.session && Array.isArray(s3.entries) ? s3 : { session: i4.session, entries: [], captureBytes: 0 };
              if (u3.entries.length >= 600) {
                devHalt(i4, "entry-limit");
                return false;
              }
              var f2 = r3 ? JSON.stringify(ytDiagnosticSanitize(r3)) : null;
              if (f2 && f2.length > 33554432) {
                devHalt(i4, "capture-event-limit");
                return false;
              }
              var d2 = u3.captureBytes || 0;
              var c2 = [16, 32, 64].indexOf(Number(l.capture_budget)) >= 0 ? Number(l.capture_budget) * 1048576 : 33554432;
              var p2 = f2 ? devUTF8Size(f2) : 0;
              if (d2 + p2 > c2) {
                devHalt(i4, "capture-budget-limit");
                return false;
              }
              var v2 = [];
              if (f2) {
                for (var g2 = 0; g2 < f2.length; ) {
                  var h2 = Math.min(g2 + 131072, f2.length);
                  if (h2 < f2.length && f2.charCodeAt(h2 - 1) >= 55296 && f2.charCodeAt(h2 - 1) <= 56319 && f2.charCodeAt(h2) >= 56320 && f2.charCodeAt(h2) <= 57343) h2--;
                  v2.push(f2.slice(g2, h2));
                  g2 = h2;
                }
                if (v2.length > 256) {
                  devHalt(i4, "capture-event-limit");
                  return false;
                }
                var y2 = "ytads.capture." + i4.session + "." + r3.id + ".";
                e3.captureRef = { prefix: y2, chunks: v2.length, chars: f2.length, storedBytes: p2, checksum: devChecksum(f2) };
              }
              var m2 = { session: i4.session, entries: u3.entries.concat([e3]), captureBytes: d2 + p2 };
              var b2 = JSON.stringify(m2);
              if (devUTF8Size(b2) > 131072) {
                devHalt(i4, "log-index-limit");
                return false;
              }
              var w2 = Date.now();
              if (f2) {
                for (var S2 = 0; S2 < e3.captureRef.chunks; S2++) {
                  var k2 = e3.captureRef.prefix + S2;
                  if (n.write(v2[S2], k2) !== true) throw new Error("capture-write-failed");
                  a2.push(k2);
                }
              }
              var x2 = Date.now();
              e3.timing = { capturePrepareMs: w2 - t2, sampleWriteMs: x2 - w2, scriptBeforeIndexCommitMs: x2 - _ };
              if (ytDiagnosticCommitEntry(m2, c2) !== true) throw new Error("log-index-write-failed");
              return true;
            } catch (e4) {
              a2.forEach(function(e5) {
                try {
                  n.write(void 0, e5);
                } catch (e6) {
                }
              });
              try {
                devHalt(i4, "storage-or-serialization-failed");
              } catch (e5) {
              }
              return false;
            }
          }
          function devChecksum(e3) {
            var r3 = 2166136261;
            for (var t2 = 0; t2 < e3.length; t2++) {
              r3 ^= e3.charCodeAt(t2);
              r3 = Math.imul(r3, 16777619);
            }
            return "fnv1a32-utf16:" + ("00000000" + (r3 >>> 0).toString(16)).slice(-8);
          }
          function devCorrelation(e3, r3) {
            return devChecksum(e3 + " " + r3);
          }
          function devCapture(t2, n2, a2, i4, o4) {
            if (!devFlag(l.capture_raw)) return;
            var s3 = null;
            try {
              s3 = devConfig();
              if (!s3 || typeof e2 === "undefined") return;
              var u3 = (/* @__PURE__ */ new Date()).toISOString();
              var f2 = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
              var v2 = { url: e2.url, method: e2.method || "GET", headers: e2.headers || {}, h2_trailers: e2.h2_trailers || {}, body: devBody(e2.body) };
              var g2 = { schema: 1, id: f2, time: u3, source: t2, version: i4, phase: n2, endpoint: a2, runtime: typeof $loon === "string" ? $loon : null, correlation: { urlMethodHash: devCorrelation(v2.method, v2.url), exactPairing: false }, request: v2, processing: { exception: x, executionScript: n2 === "request" ? "YouTubeLogger" : t2, elapsedMs: Date.now() - _, messages: k.slice(), arguments: { blocked_channels_count: p ? p.count : 0, hide_home_shorts: d, adaptive_feed_ads: c, log_level: l.log_level || "info" } } };
              if (n2 === "response" && typeof r2 !== "undefined") {
                g2.responseBefore = { status: r2.status, headers: r2.headers || {}, h2_trailers: r2.h2_trailers || {}, body: devBody(r2.body) };
                var h2 = o4 && Object.prototype.hasOwnProperty.call(o4, "body");
                g2.responseAfter = { changed: !!h2, status: o4 && o4.status !== void 0 ? o4.status : r2.status, headerOverrides: o4 && o4.headers || null, transportHeadersRecomputedByLoon: true, body: h2 ? devBody(o4.body) : { reference: "responseBefore.body" } };
              }
              devAppend({ source: t2, version: i4, endpoint: a2, level: "debug", time: u3, phase: n2, message: "development capture: " + n2 + (g2.responseAfter ? " changed=" + g2.responseAfter.changed : "") }, g2);
            } catch (e3) {
              try {
                devHalt(s3, e3.message === "capture-body-limit" ? "capture-body-limit" : "capture-serialization-failed");
              } catch (e4) {
              }
            }
          }
          function saveLog(e3) {
            k.push(e3);
            if (devFlag(l.capture_raw)) return;
            var r3 = { debug: 0, info: 1, warn: 2, error: 3 };
            var t2 = e3.indexOf("changed:") === 0 ? "info" : e3 === "pass: parse/schema check failed" ? "error" : /^(pass: (removed=|mode=|non-UMP))/.test(e3) ? "debug" : "warn";
            var n2 = Object.prototype.hasOwnProperty.call(r3, l.log_level) ? l.log_level : "info";
            if (n2 === "info" || r3[t2] >= r3[n2]) devAppend({ source: "YouTubeFeed", level: t2, time: (/* @__PURE__ */ new Date()).toISOString(), version: i3, endpoint: w, message: e3 }, null);
          }
          function log(e3) {
            saveLog(e3);
            if (f && typeof console !== "undefined") {
              console.log("[YouTubeFeed " + i3 + "] " + w + " " + e3);
            }
          }
          function fail(e3) {
            var r3 = new Error(e3);
            r3.ytNoAdsCode = e3;
            throw r3;
          }
          function header(e3, r3) {
            var t2 = Object.keys(e3 || {});
            for (var n2 = 0; n2 < t2.length; n2++) {
              if (t2[n2].toLowerCase() === r3) return String(e3[t2[n2]]).toLowerCase();
            }
            return "";
          }
          function bytesOf(e3) {
            if (e3 instanceof Uint8Array) return e3;
            if (e3 instanceof ArrayBuffer) return new Uint8Array(e3);
            if (ArrayBuffer.isView(e3)) {
              return new Uint8Array(e3.buffer, e3.byteOffset, e3.byteLength);
            }
            return null;
          }
          function read32(e3, r3) {
            var t2 = 0;
            var n2 = 1;
            for (var a2 = 0; a2 < 5; a2++) {
              if (r3.pos >= e3.length) fail("truncated-varint");
              var i4 = e3[r3.pos++];
              if (a2 === 4 && i4 > 15) fail("uint32-overflow");
              t2 += (i4 & 127) * n2;
              if (!(i4 & 128)) return t2;
              n2 *= 128;
            }
            fail("invalid-varint");
          }
          function skip64(e3, r3) {
            for (var t2 = 0; t2 < 10; t2++) {
              if (r3.pos >= e3.length) fail("truncated-varint");
              var n2 = e3[r3.pos++];
              if (t2 === 9 && n2 > 1) fail("uint64-overflow");
              if (!(n2 & 128)) return;
            }
            fail("invalid-varint");
          }
          function parse(e3, r3, t2) {
            if (t2) {
              r3.fields += t2.length;
              if (r3.fields > o3) {
                r3.fields = o3 + 1;
                fail("field-limit");
              }
              return t2;
            }
            var n2 = { pos: 0 };
            var t2 = [];
            while (n2.pos < e3.length) {
              if (++r3.fields > o3) fail("field-limit");
              var a2 = n2.pos;
              var i4 = read32(e3, n2);
              var s3 = Math.floor(i4 / 8);
              var u3 = i4 % 8;
              if (s3 < 1 || s3 > 536870911) fail("invalid-tag");
              var l2 = n2.pos;
              var f2 = n2.pos;
              if (u3 === 0) skip64(e3, n2);
              else if (u3 === 1) n2.pos += 8;
              else if (u3 === 2) {
                var d2 = read32(e3, n2);
                f2 = n2.pos;
                if (d2 > e3.length - n2.pos) fail("truncated-field");
                n2.pos += d2;
              } else if (u3 === 5) n2.pos += 4;
              else fail("unsupported-wire-type");
              if (n2.pos > e3.length) fail("truncated-field");
              t2.push({ no: s3, wire: u3, start: a2, tagEnd: l2, payloadStart: f2, end: n2.pos });
            }
            return t2;
          }
          function encodeLength(e3) {
            var r3 = [];
            do {
              var t2 = e3 % 128;
              e3 = Math.floor(e3 / 128);
              r3.push(t2 + (e3 ? 128 : 0));
            } while (e3);
            return new Uint8Array(r3);
          }
          function join(e3) {
            var r3 = 0;
            for (var t2 = 0; t2 < e3.length; t2++) r3 += e3[t2].length;
            var n2 = new Uint8Array(r3);
            var a2 = 0;
            for (var i4 = 0; i4 < e3.length; i4++) {
              n2.set(e3[i4], a2);
              a2 += e3[i4].length;
            }
            return n2;
          }
          function replaceChild(e3, r3, t2) {
            return join([e3.subarray(r3.start, r3.tagEnd), encodeLength(t2.length), t2]);
          }
          var A = { browse: { 9: "browseUnion", 10: "continuationUnion" }, next: { 7: "nextUnion", 8: "continuationUnion" }, search: { 4: "browseUnion", 10: "continuationUnion" }, browseUnion: { 49399797: "sectionList", 58173949: "browseColumns", 153515154: "opaqueElement" }, browseColumns: { 1: "tabUnion" }, tabUnion: { 58174010: "tab" }, tab: { 4: "sectionUnion" }, nextUnion: { 51779735: "nextColumn" }, nextColumn: { 1: "sectionUnion", 8: "sectionUnion" }, sectionUnion: { 49399797: "sectionList" }, continuationUnion: { 49399797: "sectionList", 51779776: "secondaryList" }, sectionList: { 1: "sectionItem", 32: "deferredUpdate" }, deferredUpdate: { 1: "deferredItems" }, deferredItems: { 1: "itemSection" }, secondaryList: { 1: "secondaryItem" }, sectionItem: { 50195462: "itemSection" }, secondaryItem: { 50195462: "itemSection" }, itemSection: { 1: "contentItem" }, contentItem: { 153515154: "cardElement" } };
          var O = { sectionItem: { 424701016: true, 55514441: true }, secondaryItem: { 424701016: true, 73920376: true }, contentItem: { 424701016: true, 73920376: true } };
          var E = { video_display_button_group_layout: { model: 491441836, command: [19, 8, 10, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] }, full_width_portrait_image_layout: { model: 478840678, command: [27, 7, 10, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] }, full_width_square_image_layout: { model: 461080918, command: [55, 7, 10, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] }, full_width_square_image_carousel_layout: { model: 33562350, command: [5, 5, 10, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] }, carousel_footered_layout: { model: 505359416, command: [31, 8, 10, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] }, video_display_full_buttoned_layout: { model: 454362329, command: [32, 8, 10, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] }, video_display_carousel_button_group_layout: { model: 33561652, command: [14, 8, 10, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] }, banner_text_icon_buttoned_layout: { model: 378585263, command: [5, 3, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] }, fullscreen_engagement_companion: { model: 252081505, command: [13, 1, 169495254, 138681778, 2, 138681066, 3, 449330433] }, engagement_header: { model: 403122092, command: [5, 2, 4, 169495254, 138681778, 2, 138681066, 3, 449330433] } };
          function child(e3, r3, t2, n2) {
            n2 = n2 || parse(e3, t2);
            var a2 = null;
            for (var i4 = 0; i4 < n2.length; i4++) {
              if (n2[i4].no !== r3) continue;
              if (a2 || n2[i4].wire !== 2) fail("eml-single-message-mismatch");
              a2 = n2[i4];
            }
            return a2 ? e3.subarray(a2.payloadStart, a2.end) : null;
          }
          function ascii(e3) {
            if (!e3 || e3.length > 160) return "";
            var r3 = "";
            for (var t2 = 0; t2 < e3.length; t2++) {
              if (e3[t2] < 32 || e3[t2] > 126) return "";
              r3 += String.fromCharCode(e3[t2]);
            }
            return r3;
          }
          function containsASCII(e3, r3) {
            if (!e3 || e3.length < r3.length) return false;
            var t2 = [];
            for (var n2 = 0; n2 < r3.length; n2++) t2.push(r3.charCodeAt(n2));
            for (var a2 = 0; a2 <= e3.length - t2.length; a2++) {
              var i4 = true;
              for (var o4 = 0; o4 < t2.length; o4++) {
                if (e3[a2 + o4] !== t2[o4]) {
                  i4 = false;
                  break;
                }
              }
              if (i4) return true;
            }
            return false;
          }
          function hasAdCommand(e3, r3, t2, n2) {
            var a2 = parse(e3, n2);
            if (t2 === r3.length) {
              var i4 = false;
              a2.forEach(function(r4) {
                if (r4.no !== 8) return;
                if (r4.wire !== 2) fail("eml-command-schema-mismatch");
                var t3 = e3.subarray(r4.payloadStart, r4.end);
                var a3 = child(t3, 1, n2), o5 = child(t3, 2, n2);
                if (a3 && ascii(a3) === "skip_ad_on_block" && o5 !== null) i4 = true;
              });
              return i4;
            }
            var o4 = false;
            a2.forEach(function(a3) {
              if (a3.no !== r3[t2]) return;
              if (a3.wire !== 2) fail("eml-command-schema-mismatch");
              if (hasAdCommand(e3.subarray(a3.payloadStart, a3.end), r3, t2 + 1, n2)) o4 = true;
            });
            return o4;
          }
          function classifyElement(e3, r3) {
            var t2 = parse(e3, r3), n2 = child(e3, 172660663, r3, t2);
            if (!n2 || parse(e3, r3, t2).some(function(e4) {
              return e4.no >= 1e6 && e4.no !== 172660663;
            })) return { ad: false, divider: false };
            var a2 = parse(n2, r3);
            if (a2.some(function(e4) {
              return e4.no === 3;
            })) return { ad: false, divider: false };
            var i4 = child(n2, 1, r3, parse(n2, r3, a2));
            if (!i4) return { ad: false, divider: false };
            var o4 = parse(i4, r3), s3 = child(i4, 168777401, r3, o4);
            if (!s3) return { ad: false, divider: false };
            var u3 = child(s3, 3, r3);
            if (!u3) return { ad: false, divider: false };
            var l2 = parse(u3, r3), f2 = child(u3, 172035250, r3, l2);
            if (!f2) return { ad: false, divider: false };
            var d2 = ascii(child(f2, 1, r3));
            var c2 = /^([a-z_]+)\.eml-fe\|[0-9a-f]{16}$/.exec(d2);
            if (!c2) return { ad: false, divider: false };
            var p2 = c2[1], v2 = E[p2];
            if (!v2 && p2 !== "cell_divider") return { ad: false, divider: false };
            var g2 = child(s3, 5, r3);
            if (!g2) return { ad: false, divider: false };
            var h2 = parse(g2, r3);
            if (parse(i4, r3, o4).length !== 1 || parse(u3, r3, l2).length !== 1 || h2.length !== 1) return { ad: false, divider: false };
            var y2 = v2 ? v2.model : 347043917, m2 = h2[0];
            if (m2.no !== y2) return { ad: false, divider: false };
            if (m2.wire !== 2) fail("eml-model-schema-mismatch");
            if (!v2) return { ad: false, divider: true };
            return { ad: hasAdCommand(g2.subarray(m2.payloadStart, m2.end), v2.command, 0, r3), divider: false };
          }
          function watchNextAdAction(e3, r3) {
            var t2 = child(e3, 361588638, r3);
            if (!t2) return false;
            var n2 = child(t2, 2, r3);
            if (!n2) return false;
            var a2 = child(n2, 153515154, r3);
            if (!a2) return false;
            return classifyElement(a2, r3).ad;
          }
          function watchNextAdCompanion(e3, r3, t2) {
            var n2 = e3;
            for (var a2 = 0; a2 < r3.length; a2++) {
              n2 = child(n2, r3[a2], t2);
              if (!n2) return false;
            }
            var i4 = child(n2, 153515154, t2);
            return !!i4 && classifyElement(i4, t2).ad;
          }
          function watchNextAdOverlay(e3, r3) {
            var t2 = parse(e3, r3);
            if (t2.length !== 1 || t2[0].no !== 62960614 || t2[0].wire !== 2) return false;
            var n2 = e3.subarray(t2[0].payloadStart, t2[0].end);
            return containsASCII(n2, "googleadservices.com/pagead/") || containsASCII(n2, "youtube.com/pagead/") || containsASCII(n2, "yt-ads-web-view-id");
          }
          function continuationBrowseId(e3, r3) {
            if (typeof e3 !== "string" || e3.length > 16384) return "";
            try {
              e3 = decodeURIComponent(e3).replace(/-/g, "+").replace(/_/g, "/");
              if (!/^[A-Za-z0-9+/]*={0,2}$/.test(e3) || e3.length % 4 === 1) return "";
              var t2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
              var n2 = [], a2 = 0, i4 = 0;
              for (var o4 = 0; o4 < e3.length && e3[o4] !== "="; o4++) {
                a2 = a2 << 6 | t2.indexOf(e3[o4]);
                i4 += 6;
                if (i4 >= 8) {
                  i4 -= 8;
                  n2.push(a2 >>> i4 & 255);
                }
              }
              var s3 = child(new Uint8Array(n2), 80226972, r3);
              return s3 ? ascii(child(s3, 2, r3)) : "";
            } catch (e4) {
              if (e4.ytNoAdsCode === "field-limit") throw e4;
              return "";
            }
          }
          function protoHomeContinuation(e3, r3, t2) {
            var n2 = [];
            r3.forEach(function(r4) {
              if (r4.no !== 2 || r4.wire !== 2) return;
              var a2 = e3.subarray(r4.payloadStart, r4.end);
              [52047593, 60487319].forEach(function(e4) {
                var r5 = child(a2, e4, t2);
                if (r5) {
                  var i4 = child(r5, 1, t2);
                  if (i4) n2.push(continuationBrowseId(asciiToken(i4), t2));
                }
              });
            });
            return n2.length > 0 && n2.every(function(e4) {
              return e4 === "FEwhat_to_watch";
            });
          }
          function asciiToken(e3) {
            if (!e3 || e3.length > 16384) return "";
            var r3 = "";
            for (var t2 = 0; t2 < e3.length; t2++) {
              if (e3[t2] < 32 || e3[t2] > 126) return "";
              r3 += String.fromCharCode(e3[t2]);
            }
            return r3;
          }
          function shortsCell(e3, r3) {
            var t2 = parse(e3, r3);
            if (t2.some(function(e4) {
              return e4.no >= 1e6 && e4.no !== 153515154;
            })) return false;
            var n2 = child(e3, 153515154, r3);
            if (!n2 || parse(n2, r3).some(function(e4) {
              return e4.no >= 1e6 && e4.no !== 172660663;
            })) return false;
            var a2 = child(n2, 172660663, r3);
            if (!a2 || parse(a2, r3).some(function(e4) {
              return e4.no === 3;
            })) return false;
            var i4 = child(a2, 1, r3);
            if (!i4 || parse(i4, r3).length !== 1) return false;
            var o4 = child(i4, 168777401, r3);
            if (!o4) return false;
            var s3 = child(o4, 3, r3), u3 = child(o4, 5, r3);
            if (!s3 || !u3 || parse(s3, r3).length !== 1) return false;
            var l2 = child(s3, 172035250, r3);
            if (!l2 || !/^shorts_video_cell\.eml-fe\|[0-9a-f]{16}$/.test(ascii(child(l2, 1, r3)))) return false;
            var f2 = parse(u3, r3);
            return f2.length === 1 && f2[0].no === 519005951 && f2[0].wire === 2;
          }
          function shortsShelf(e3, r3) {
            var t2 = child(e3, 5, r3);
            if (!t2 || parse(t2, r3).length !== 1) return false;
            var n2 = child(t2, 51431404, r3);
            if (!n2) return false;
            var a2 = parse(n2, r3), i4 = 0, o4 = true;
            a2.forEach(function(e4) {
              if (e4.no !== 1) return;
              i4++;
              if (e4.wire !== 2 || !shortsCell(n2.subarray(e4.payloadStart, e4.end), r3)) o4 = false;
            });
            return i4 > 0 && o4;
          }
          function cleanProto(e3, r3, t2, n2, a2) {
            if (n2 > 32) fail("protobuf-depth-limit");
            var i4 = parse(e3, t2), o4 = A[r3] || {}, s3 = O[r3] || {};
            var u3 = [], l2 = 0, f2 = 0, v2 = 0, g2 = 0, h2 = 0, y2 = 0, m2 = 0, b2 = false, S2 = false;
            if (d && w === "browse") {
              if (r3 === "tab") a2 = ascii(child(e3, 11, t2)) === "FEwhat_to_watch";
              if (r3 === "sectionList" && !a2) a2 = protoHomeContinuation(e3, i4, t2);
            }
            var k2 = 0, x2 = 0, _2 = false, E2 = false;
            i4.forEach(function(e4) {
              if (s3[e4.no]) {
                if (e4.wire !== 2) fail("feed-ad-schema-mismatch");
                b2 = true;
              }
            });
            if (b2 && i4.some(function(e4) {
              return e4.no >= 1e6 && !s3[e4.no];
            })) fail("feed-mixed-renderer");
            i4.forEach(function(b3) {
              if (s3[b3.no]) {
                l2++;
                S2 = true;
                return;
              }
              if (r3 === "next" && b3.no === 15 && b3.wire === 2 && watchNextAdAction(e3.subarray(b3.payloadStart, b3.end), t2)) {
                l2++;
                y2++;
                return;
              }
              if (r3 === "next" && b3.no === 14 && b3.wire === 2 && watchNextAdOverlay(e3.subarray(b3.payloadStart, b3.end), t2)) {
                l2++;
                y2++;
                return;
              }
              if (r3 === "next" && b3.wire === 2 && (b3.no === 37 && watchNextAdCompanion(e3.subarray(b3.payloadStart, b3.end), [253885845, 1], t2) || b3.no === 42 && watchNextAdCompanion(e3.subarray(b3.payloadStart, b3.end), [357104971, 2, 361256913, 1, 138681066, 2, 194605894, 1], t2))) {
                l2++;
                y2++;
                return;
              }
              if (d && w === "browse" && a2 && r3 === "sectionItem" && b3.no === 51845067) {
                if (b3.wire !== 2) fail("shorts-shelf-schema-mismatch");
                if (shortsShelf(e3.subarray(b3.payloadStart, b3.end), t2) && !i4.some(function(e4) {
                  return e4.no >= 1e6 && e4.no !== 51845067;
                })) {
                  g2++;
                  S2 = true;
                  return;
                }
              }
              if (p && b3.no === 50630979 && b3.wire === 2 && /^(?:sectionItem|secondaryItem|contentItem)$/.test(r3) && !i4.some(function(e4) {
                return e4.no >= 1e6 && e4.no !== 50630979;
              }) && blockedProtoModel(e3.subarray(b3.payloadStart, b3.end))) {
                f2++;
                S2 = true;
                return;
              }
              var A2 = o4[b3.no];
              if (!A2) {
                u3.push(e3.subarray(b3.start, b3.end));
                return;
              }
              if (b3.wire !== 2) fail("feed-envelope-schema-mismatch");
              if (A2 === "opaqueElement") {
                h2++;
                u3.push(e3.subarray(b3.start, b3.end));
                return;
              }
              var O2;
              if (A2 === "cardElement") {
                var C3 = e3.subarray(b3.payloadStart, b3.end);
                var T2 = classifyElement(C3, t2);
                if (!T2.ad && c && C3.length >= 1e3 && containsASCII(C3, "pagead")) {
                  T2.ad = true;
                  v2++;
                }
                if (T2.ad && i4.some(function(e4) {
                  return e4.no >= 1e6 && e4.no !== 153515154;
                })) fail("feed-mixed-renderer");
                if (T2.ad) {
                  l2++;
                  y2++;
                  S2 = true;
                  return;
                }
                if (p && !i4.some(function(e4) {
                  return e4.no >= 1e6 && e4.no !== 153515154;
                }) && blockedProtoElement(C3)) {
                  f2++;
                  S2 = true;
                  return;
                }
                h2++;
                E2 = T2.divider && i4.length === 1;
                u3.push(e3.subarray(b3.start, b3.end));
                return;
              }
              O2 = cleanProto(e3.subarray(b3.payloadStart, b3.end), A2, t2, n2 + 1, a2);
              l2 += O2.removed;
              f2 += O2.blocked || 0;
              v2 += O2.adaptive || 0;
              g2 += O2.shorts;
              h2 += O2.opaque;
              y2 += O2.eml;
              m2 += O2.dividers;
              if ((r3 === "sectionList" || r3 === "secondaryList" || r3 === "itemSection" || r3 === "deferredItems") && b3.no === 1) {
                k2++;
                if (O2.drop) {
                  _2 = O2.removed > 0 || O2.blocked > 0;
                  return;
                }
                if ((r3 !== "itemSection" || w === "search") && _2 && O2.divider) {
                  m2++;
                  _2 = false;
                  return;
                }
                _2 = false;
                x2++;
                if (r3 === "itemSection") E2 = k2 === 1 && O2.divider;
              }
              if (r3 === "sectionItem" || r3 === "secondaryItem") {
                if (O2.drop) {
                  if (i4.some(function(e4) {
                    return e4.no >= 1e6 && e4.no !== 50195462;
                  })) fail("feed-mixed-renderer");
                  S2 = true;
                }
                E2 = O2.divider && i4.length === 1;
              }
              u3.push(O2.removed || O2.blocked || O2.shorts || O2.dividers ? replaceChild(e3, b3, O2.body) : e3.subarray(b3.start, b3.end));
            });
            if (r3 === "itemSection") {
              var C2 = i4.every(function(e4) {
                return e4.no === 1 || e4.no === 4 || e4.no === 8;
              });
              S2 = (l2 > 0 || f2 > 0) && k2 > 0 && x2 === 0 && C2;
              E2 = E2 && k2 === 1 && C2;
            }
            return { body: l2 || f2 || g2 || m2 ? join(u3) : e3, removed: l2, blocked: f2, adaptive: v2, shorts: g2, opaque: h2, eml: y2, dividers: m2, drop: S2, divider: E2 };
          }
          function channelBlocklist(e3) {
            if (typeof $loon !== "string" || typeof e3 !== "string" || !e3.trim() || e3.length > 8192) return null;
            var r3 = e3.trim().split(/\s+/), t2 = { ids: /* @__PURE__ */ Object.create(null), handles: /* @__PURE__ */ Object.create(null), names: /* @__PURE__ */ Object.create(null), count: 0 };
            if (r3.length > 256) return null;
            for (var n2 = 0; n2 < r3.length; n2++) {
              var a2 = r3[n2];
              if (a2.length > 160 || /[<>\x00-\x1f]/.test(a2)) continue;
              var i4 = channelKey(a2);
              if (!i4) continue;
              var o4 = i4.kind === "id" ? t2.ids : i4.kind === "handle" ? t2.handles : t2.names;
              if (!o4[i4.value]) {
                o4[i4.value] = true;
                t2.count++;
              }
            }
            return t2.count ? t2 : null;
          }
          function loadChannelBlocklist() {
            var e3 = channelBlocklist(l.blocked_channels);
            if (typeof $loon !== "string" || typeof l.blocked_channels_url !== "string" || !l.blocked_channels_url.trim() || typeof n === "undefined") return e3;
            try {
              var r3 = n.read("ytads.channels.remote.v1");
              if (typeof r3 !== "string" || r3.length > 16384) return e3;
              var t2 = JSON.parse(r3);
              if (!t2 || t2.schema !== 1 || t2.url !== l.blocked_channels_url.trim() || !Number.isFinite(t2.fetchedAt)) return e3;
              var a2 = channelBlocklist(t2.text);
              if (!a2) return e3;
              if (!e3) return a2;
              ["ids", "handles", "names"].forEach(function(r4) {
                Object.keys(a2[r4]).forEach(function(t3) {
                  if (!e3[r4][t3]) {
                    e3[r4][t3] = true;
                    e3.count++;
                  }
                });
              });
              return e3;
            } catch (r4) {
              return e3;
            }
          }
          function channelKey(e3) {
            if (typeof e3 !== "string") return null;
            var r3 = e3.trim();
            if (!r3 || r3.length > 160) return null;
            if (/^https?:\/\//i.test(r3)) {
              var t2 = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/(channel\/UC[\w-]{22}|@[^/?#\s]+)\/?$/i.exec(r3);
              if (!t2) return null;
              r3 = "/" + t2[1];
            }
            if (r3.indexOf("/channel/") === 0) r3 = r3.slice(9);
            if (r3.indexOf("/@") === 0) r3 = r3.slice(1);
            if (typeof r3.normalize === "function") r3 = r3.normalize("NFC");
            if (/^UC[\w-]{22}$/.test(r3)) return { kind: "id", value: r3 };
            if (/^@[^\s/?#<>]{1,100}$/.test(r3)) return { kind: "handle", value: r3.toLowerCase() };
            if (/^(?:[a-z]+:|\/)/i.test(r3) || /[\x00-\x1f<>]/.test(r3)) return null;
            return { kind: "name", value: r3 };
          }
          function blockedIdentity(e3, r3, t2) {
            if (!p) return false;
            var n2;
            if (v) {
              if (typeof e3 === "string" && p.ids[e3]) return true;
              n2 = channelKey(e3);
              if (n2 && n2.kind === "id" && p.ids[n2.value]) return true;
            }
            if (g) {
              n2 = channelKey(r3);
              if (n2 && n2.kind === "handle" && p.handles[n2.value]) return true;
            }
            if (h) {
              n2 = channelKey(t2);
              if (n2 && n2.kind === "name" && p.names[n2.value]) return true;
            }
            return false;
          }
          var C = { videoRenderer: true, compactVideoRenderer: true, gridVideoRenderer: true, reelItemRenderer: true, playlistVideoRenderer: true, lockupViewModel: true, shortsLockupViewModel: true };
          function blockedJSONCard(e3, r3) {
            if (!p || !object(e3) || r3 > 8) return false;
            var t2 = Object.keys(e3), n2 = "";
            for (var a2 = 0; a2 < t2.length; a2++) {
              if (!/(?:Renderer|ViewModel)$/.test(t2[a2])) continue;
              if (n2) return false;
              n2 = t2[a2];
            }
            if (!n2) return false;
            var i4 = e3[n2];
            if (!object(i4)) return false;
            if (n2 === "richItemRenderer") return blockedJSONCard(i4.content, r3 + 1);
            if (!Object.prototype.hasOwnProperty.call(C, n2)) return false;
            if (n2 === "lockupViewModel" && i4.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO" && i4.contentType !== "LOCKUP_CONTENT_TYPE_SHORT") return false;
            if (blockedIdentity(i4.channelId, i4.channelHandle, null)) return true;
            function author(e4) {
              if (!object(e4)) return false;
              if (typeof e4.simpleText === "string" && blockedIdentity(null, null, e4.simpleText)) return true;
              var r4 = Array.isArray(e4.runs) ? e4.runs : [];
              for (var t3 = 0; t3 < r4.length && t3 < 32; t3++) {
                var n3 = r4[t3], a3 = n3 && n3.navigationEndpoint && n3.navigationEndpoint.browseEndpoint;
                if (a3 && blockedIdentity(a3.browseId, a3.canonicalBaseUrl, n3.text)) return true;
              }
              return false;
            }
            if (author(i4.ownerText) || author(i4.shortBylineText) || author(i4.longBylineText) || author(i4.bylineText)) return true;
            var o4 = i4.channelThumbnailSupportedRenderers && i4.channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer;
            var s3 = o4 && o4.navigationEndpoint && o4.navigationEndpoint.browseEndpoint;
            if (s3 && blockedIdentity(s3.browseId, s3.canonicalBaseUrl, null)) return true;
            var u3 = i4.metadata && i4.metadata.lockupMetadataViewModel;
            var l2 = u3 && u3.metadata && u3.metadata.contentMetadataViewModel;
            var f2 = l2 && l2.metadataRows;
            if (!Array.isArray(f2)) return false;
            for (var d2 = 0; d2 < f2.length && d2 < 8; d2++) {
              var c2 = f2[d2] && f2[d2].metadataParts;
              if (!Array.isArray(c2)) continue;
              for (var v2 = 0; v2 < c2.length && v2 < 16; v2++) {
                var g2 = c2[v2] && c2[v2].text;
                if (!object(g2) || !Array.isArray(g2.commandRuns)) continue;
                for (var y2 = 0; y2 < g2.commandRuns.length && y2 < 32; y2++) {
                  var m2 = g2.commandRuns[y2], b2 = m2 && m2.onTap && m2.onTap.innertubeCommand && m2.onTap.innertubeCommand.browseEndpoint;
                  if (!b2) continue;
                  var w2 = null, S2 = m2.startIndex, k2 = m2.length;
                  if (h && typeof g2.content === "string" && Number.isInteger(S2) && Number.isInteger(k2) && S2 >= 0 && k2 > 0 && S2 + k2 <= g2.content.length) w2 = g2.content.slice(S2, S2 + k2);
                  if (blockedIdentity(b2.browseId, b2.canonicalBaseUrl, w2)) return true;
                }
              }
            }
            return false;
          }
          function blockedProtoModel(e3) {
            if (!y || m.fields >= o3) return false;
            var r3 = null, t2 = 0;
            function text(e4) {
              if (!e4 || e4.length > 640 || typeof TextDecoder !== "function") return "";
              try {
                if (!b) b = new TextDecoder("utf-8", { fatal: true });
                return b.decode(e4);
              } catch (e5) {
                return "";
              }
            }
            function browse(e4) {
              var r4 = parse(e4, m), t3 = "", n2 = "";
              for (var a2 = 0; a2 < r4.length; a2++) {
                var i4 = r4[a2];
                if (i4.wire !== 2) continue;
                var o4 = text(e4.subarray(i4.payloadStart, i4.end));
                if (i4.no === 2 && /^UC[\w-]{22}$/.test(o4)) {
                  if (t3 && t3 !== o4) return null;
                  t3 = o4;
                }
                if (g && o4.indexOf("/@") === 0) {
                  var s3 = channelKey(o4);
                  if (s3 && s3.kind === "handle") n2 = o4;
                }
              }
              return t3 ? { id: t3, handle: n2 } : null;
            }
            function walk(e4, n2) {
              if (++t2 > 256 || n2 > 16) throw Error("channel-scan-limit");
              var a2;
              try {
                a2 = parse(e4, m);
              } catch (e5) {
                if (e5.ytNoAdsCode === "field-limit") throw e5;
                return;
              }
              for (var i4 = 0; i4 < a2.length; i4++) {
                var o4 = a2[i4];
                if (o4.wire !== 2) continue;
                var s3 = e4.subarray(o4.payloadStart, o4.end);
                if (o4.no === 48687626) {
                  var u3 = browse(s3);
                  if (u3) {
                    if (r3 && r3.id !== u3.id) throw Error("ambiguous-channel");
                    r3 = { id: u3.id, handle: u3.handle || r3 && r3.handle || "" };
                  }
                  continue;
                }
                walk(s3, n2 + 1);
              }
            }
            try {
              walk(e3, 0);
              return !!r3 && blockedIdentity(r3.id, r3.handle, null);
            } catch (e4) {
              return false;
            }
          }
          function blockedProtoElement(e3) {
            if (!y || m.fields >= o3) return false;
            try {
              var r3 = parse(e3, m);
              if (r3.some(function(e4) {
                return e4.no >= 1e6 && e4.no !== 172660663;
              })) return false;
              var t2 = child(e3, 172660663, m, parse(e3, m, r3));
              if (!t2) return false;
              var n2 = parse(t2, m);
              if (n2.some(function(e4) {
                return e4.no === 3;
              })) return false;
              var a2 = child(t2, 1, m, parse(t2, m, n2));
              if (!a2) return false;
              var i4 = parse(a2, m);
              if (i4.some(function(e4) {
                return e4.no >= 1e6 && e4.no !== 168777401;
              })) return false;
              var s3 = child(a2, 168777401, m, parse(a2, m, i4));
              if (!s3) return false;
              var u3 = parse(s3, m);
              var l2 = child(s3, 3, m, u3), f2 = child(s3, 5, m, parse(s3, m, u3));
              if (!l2 || !f2) return false;
              var d2 = parse(l2, m);
              if (d2.length !== 1) return false;
              var c2 = child(l2, 172035250, m, parse(l2, m, d2));
              if (!c2) return false;
              var p2 = ascii(child(c2, 1, m));
              if (!/^(?:video_lockup_with_attachment|video_lockup|video_cell|compact_video_cell|shorts_video_cell)\.eml-fe\|[0-9a-f]{16}$/.test(p2)) return false;
              r3 = parse(f2, m);
              if (r3.length !== 1 || r3[0].wire !== 2) return false;
              return blockedProtoModel(f2.subarray(r3[0].payloadStart, r3[0].end));
            } catch (e4) {
              return false;
            }
          }
          var T = ["adSlotRenderer", "adPlacementRenderer", "inFeedAdLayoutRenderer", "displayAdRenderer", "promotedVideoRenderer", "promotedSparklesWebRenderer", "promotedSparklesTextSearchRenderer", "compactPromotedItemRenderer", "compactPromotedVideoRenderer", "gridPromotedVideoRenderer", "searchPyvRenderer", "carouselAdRenderer", "companionAdRenderer"];
          function object(e3) {
            return !!e3 && typeof e3 === "object" && !Array.isArray(e3);
          }
          function adCard(e3, r3) {
            if (!object(e3) || r3 > 8) return false;
            var t2 = Object.keys(e3), n2 = false;
            t2.forEach(function(r4) {
              if (T.indexOf(r4) >= 0 && object(e3[r4])) n2 = true;
            });
            if (n2) {
              if (t2.some(function(e4) {
                return /(?:Renderer|ViewModel)$/.test(e4) && T.indexOf(e4) < 0;
              })) fail("feed-mixed-renderer");
              return true;
            }
            if (object(e3.richItemRenderer) && adCard(e3.richItemRenderer.content, r3 + 1)) {
              if (t2.some(function(e4) {
                return e4 !== "richItemRenderer" && /(?:Renderer|ViewModel)$/.test(e4);
              })) fail("feed-mixed-renderer");
              return true;
            }
            return false;
          }
          function jsonHome(e3) {
            if (!object(e3)) return false;
            if (e3.targetId === "browse-feedFEwhat_to_watch") return true;
            var r3 = [], t2 = e3.endpoint && e3.endpoint.browseEndpoint;
            if (typeof e3.tabIdentifier === "string") r3.push(e3.tabIdentifier);
            if (t2 && typeof t2.browseId === "string") r3.push(t2.browseId);
            if (Array.isArray(e3.continuations)) e3.continuations.forEach(function(e4) {
              if (!object(e4)) return;
              ["nextContinuationData", "reloadContinuationData"].forEach(function(t3) {
                if (object(e4[t3])) r3.push(continuationBrowseId(e4[t3].continuation, { fields: 0 }));
              });
            });
            return r3.length > 0 && r3.every(function(e4) {
              return e4 === "FEwhat_to_watch";
            });
          }
          function requestHome() {
            if (!d || w !== "browse") return false;
            try {
              var r3 = e2.body, t2 = bytesOf(r3), n2 = { fields: 0 };
              if (typeof r3 === "string") {
                if (r3.length > s2) return false;
                var a2 = JSON.parse(r3);
                return a2.browseId === "FEwhat_to_watch" || !a2.browseId && continuationBrowseId(a2.continuation, n2) === "FEwhat_to_watch";
              }
              if (!t2 || t2.length > s2) return false;
              var i4 = child(t2, 2, n2);
              if (i4) return ascii(i4) === "FEwhat_to_watch";
              return continuationBrowseId(asciiToken(child(t2, 7, n2)), n2) === "FEwhat_to_watch";
            } catch (e3) {
              return false;
            }
          }
          function jsonShortsCard(e3, r3) {
            if (!object(e3) || r3 > 8) return false;
            var t2 = Object.keys(e3), n2 = t2.filter(function(e4) {
              return /(?:Renderer|ViewModel)$/.test(e4);
            });
            if (n2.length !== 1) return false;
            var a2 = n2[0], i4 = e3[a2];
            if (!object(i4)) return false;
            if (a2 === "richSectionRenderer") return jsonShortsCard(i4.content, r3 + 1);
            if (a2 === "itemSectionRenderer") {
              return Object.keys(i4).every(function(e4) {
                return ["contents", "trackingParams", "sectionIdentifier", "targetId"].indexOf(e4) >= 0;
              }) && Array.isArray(i4.contents) && i4.contents.length > 0 && i4.contents.every(function(e4) {
                return jsonShortsCard(e4, r3 + 1);
              });
            }
            function shortsItem(e4, r4) {
              if (!object(e4) || r4 > 8) return false;
              var t3 = Object.keys(e4).filter(function(e5) {
                return /(?:Renderer|ViewModel)$/.test(e5);
              });
              if (t3.length !== 1) return false;
              if (t3[0] === "richItemRenderer" && object(e4.richItemRenderer)) return shortsItem(e4.richItemRenderer.content, r4 + 1);
              return (t3[0] === "reelItemRenderer" || t3[0] === "shortsLockupViewModel") && object(e4[t3[0]]);
            }
            var o4;
            if (a2 === "reelShelfRenderer") o4 = i4.items;
            else if (a2 === "richShelfRenderer" && i4.icon && i4.icon.iconType === "YOUTUBE_SHORTS_BRAND_24") o4 = i4.contents;
            else if (a2 === "shelfRenderer" && i4.content && object(i4.content.horizontalListRenderer) && Object.keys(i4.content).length === 1) o4 = i4.content.horizontalListRenderer.items;
            return Array.isArray(o4) && o4.length > 0 && o4.every(function(e4) {
              return shortsItem(e4, 0);
            });
          }
          function cleanJSON(e3) {
            var r3 = JSON.parse(e3), t2 = 0, n2 = 0, a2 = 0, i4 = 0, o4 = 0;
            var s3 = d && w === "browse";
            function walk(e4, r4, l2) {
              if (!e4 || typeof e4 !== "object") return;
              if (++t2 > u2 || r4 > 64) fail("json-limit");
              if (Array.isArray(e4)) {
                e4.forEach(function(e5) {
                  walk(e5, r4 + 1, l2);
                });
                return;
              }
              if (s3 && jsonHome(e4)) l2 = true;
              Object.keys(e4).forEach(function(t3) {
                var u3 = e4[t3];
                if (t3 === "elementRenderer") o4++;
                if ((t3 === "contents" || t3 === "continuationItems" || t3 === "results" || t3 === "items") && Array.isArray(u3)) {
                  e4[t3] = u3.filter(function(e5) {
                    if (adCard(e5, 0)) {
                      n2++;
                      return false;
                    }
                    if (p && blockedJSONCard(e5, 0)) {
                      a2++;
                      return false;
                    }
                    if (s3 && l2 && jsonShortsCard(e5, 0)) {
                      i4++;
                      return false;
                    }
                    return true;
                  });
                  u3 = e4[t3];
                }
                walk(u3, r4 + 1, t3 === "tabRenderer" ? s3 && jsonHome(u3) : l2);
              });
            }
            walk(r3, 0, requestHome());
            return { body: n2 || a2 || i4 ? JSON.stringify(r3) : e3, removed: n2, blocked: a2, shorts: i4, opaque: o4 };
          }
          function run() {
            var t2 = S.exec(typeof e2 !== "undefined" ? e2.url || "" : "");
            if (!t2 || typeof r2 === "undefined") return {};
            w = t2[1].toLowerCase();
            if (r2.status !== void 0 && Number(r2.status) !== 200) {
              log("pass: non-200");
              return {};
            }
            var n2 = header(r2.headers, "content-type").split(";")[0].trim();
            var a2 = r2.body, i4 = bytesOf(a2);
            if (typeof a2 !== "string" && !i4) {
              log("pass: body unavailable");
              return {};
            }
            if ((i4 ? i4.length : devUTF8Size(a2)) > s2) {
              log("pass: size-limit");
              return {};
            }
            if (!(i4 ? i4.length : a2.length)) {
              log("pass: empty");
              return {};
            }
            if (i4 && i4[0] === 31 && i4[1] === 139) {
              log("pass: compressed body");
              return {};
            }
            var o4 = /^(?:application\/(?:json|[\w.+-]+\+json)|text\/json)$/.test(n2), u3;
            if (o4 || !n2 && typeof a2 === "string") {
              var l2 = a2;
              if (i4) {
                if (typeof TextDecoder !== "function") {
                  log("pass: no UTF-8 decoder");
                  return {};
                }
                l2 = new TextDecoder("utf-8", { fatal: true }).decode(i4);
              }
              u3 = cleanJSON(l2);
              if ((u3.removed || u3.blocked || u3.shorts) && i4) {
                if (typeof TextEncoder !== "function") {
                  log("pass: no UTF-8 encoder");
                  return {};
                }
                u3.body = new TextEncoder().encode(u3.body);
              }
            } else {
              if (!i4 || !/^(?:application\/(?:x-protobuf|protobuf|vnd\.google\.protobuf|octet-stream))$/.test(n2)) {
                log("pass: unsupported content type");
                return {};
              }
              u3 = cleanProto(i4, w, { fields: 0 }, 0, requestHome());
            }
            log((u3.removed || u3.blocked || u3.shorts ? "changed" : "pass") + ": removed=" + u3.removed + " adaptive_removed=" + (u3.adaptive || 0) + " format=" + (o4 || typeof a2 === "string" ? "json" : "protobuf") + " opaque_elements=" + u3.opaque + " removed_eml=" + (u3.eml || 0) + " removed_dividers=" + (u3.dividers || 0) + " hidden_shorts=" + (u3.shorts || 0) + " hidden_channels=" + (u3.blocked || 0));
            return u3.removed || u3.blocked || u3.shorts ? { body: u3.body } : {};
          }
          var R = {};
          try {
            R = run();
          } catch (e3) {
            devFailure(e3);
            log("pass: " + (e3.ytNoAdsCode || "parse/schema check failed"));
          }
          if (typeof e2 !== "undefined" && typeof r2 !== "undefined" && S.test(e2.url || "")) devCapture("YouTubeFeed", "response", w, i3, R);
          a(R);
        })();
      } else {
        a({});
      }
    })();
  }, e);
}
export {
  YouTubeFeed
};
