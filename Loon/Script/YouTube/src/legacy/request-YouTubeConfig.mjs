// devchristian1337; extracted from the previously vendored bundle. See SOURCE.md.
import { ytRuntimeInvoke } from "../legacy-runtime.mjs";
function YouTubeConfig(e, t) {
  return ytRuntimeInvoke(function(e2, t2, r, n, a) {
    var i = Date.now();
    var o = null;
    try {
      var s = typeof $script !== "undefined" && $script ? $script.startTime : null;
      var u = s && typeof s.getTime === "function" ? s.getTime() : null;
      if (typeof u === "number" && Number.isFinite(u) && u >= 0 && u <= i) o = u;
    } catch (e3) {
    }
    function ytDiagnosticStampTiming(e3) {
      var t3 = Date.now(), r2 = e3.timing && typeof e3.timing === "object" && !Array.isArray(e3.timing) ? e3.timing : {};
      var n2 = t3 - i;
      if (Number.isFinite(n2) && n2 >= 0 && n2 <= 6e5) r2.jsBeforeIndexCommitMs = n2;
      if (o !== null) {
        var a2 = t3 - o;
        if (Number.isFinite(a2) && a2 >= 0 && a2 <= 6e5) r2.runtimeBeforeIndexCommitMs = a2;
      }
      if (Object.keys(r2).length) e3.timing = r2;
    }
    function ytDiagnosticShouldRecord(e3, t3, r2) {
      var n2 = t3 && t3.processing;
      var a2 = e3.level === "error" || !!(t3 && t3.responseBefore && Number(t3.responseBefore.status) >= 400 && Number(t3.responseBefore.status) <= 599) || !!(n2 && n2.exception) || /inner=(?:authentication_failed|compression_failed|invalid_config_key|protocol_cleanup_failed)/.test(e3.message);
      if (a2) e3.level = "error";
      if (r2 === "error") return a2;
      if (r2 === "warn") return a2 || e3.level === "warn";
      if (r2 !== "debug" && e3.level === "debug") e3.level = "info";
      return true;
    }
    function ytDiagnosticCommitEntry(e3, t3) {
      var r2 = "ytads.logger.config.v1", a2 = "ytads.logger.entries.v2";
      var i2 = JSON.parse(n.read(r2) || "null");
      if (!i2 || !i2.enabled || i2.session !== e3.session) throw Error("log-session-inactive");
      var o2 = n.read(a2);
      if (o2 && o2.length > 131072) throw Error("log-index-invalid");
      var s2 = o2 ? JSON.parse(o2) : null;
      var u2 = s2 && s2.session === e3.session && Array.isArray(s2.entries) ? s2 : { session: e3.session, entries: [], captureBytes: 0 };
      var l = e3.entries[e3.entries.length - 1];
      var f = l.captureRef ? l.captureRef.storedBytes : 0;
      var c = Number(u2.captureBytes || 0);
      if (!Number.isFinite(c) || c < 0 || !Number.isFinite(f) || f < 0) throw Error("log-index-invalid");
      var d = u2.entries.length >= 600 ? "entry-limit" : c + f > t3 ? "capture-budget-limit" : null;
      ytDiagnosticStampTiming(l);
      var p = JSON.stringify({ session: e3.session, entries: u2.entries.concat([l]), captureBytes: c + f });
      if (!d && unescape(encodeURIComponent(p)).length > 131072) d = "log-index-limit";
      if (d) {
        i2.enabled = false;
        i2.haltReason = d;
        i2.haltedAt = (/* @__PURE__ */ new Date()).toISOString();
        if (n.write(JSON.stringify(i2), r2) !== true) throw Error("log-stop-write-failed");
        throw Error(d);
      }
      if (n.write(p, a2) !== true) throw Error("log-index-write-failed");
      return true;
    }
    function ytDiagnosticPurgeLegacy() {
      if (typeof n === "undefined") return;
      var e3 = "ytads.logger.privacy.v1";
      if (n.read(e3) === "structure-only-v1") return;
      var t3 = n.read("ytads.logger.entries.v2"), r2 = t3 ? JSON.parse(t3) : null;
      if (r2 && Array.isArray(r2.entries)) {
        for (var a2 = 0; a2 < r2.entries.length; a2++) {
          var i2 = r2.entries[a2], o2 = i2 && i2.captureRef;
          if (!o2) continue;
          if (typeof o2.prefix !== "string" || !/^ytads\.capture\.[a-z0-9-]+\.[a-z0-9-]+\.$/.test(o2.prefix) || !Number.isInteger(o2.chunks) || o2.chunks < 1 || o2.chunks > 256) throw Error("privacy-invalid-reference");
          for (var s2 = 0; s2 < o2.chunks; s2++) if (n.write(void 0, o2.prefix + s2) !== true) throw Error("privacy-delete-failed");
          delete i2.captureRef;
          i2.message = "legacy capture removed for privacy";
        }
        r2.captureBytes = 0;
        if (n.write(JSON.stringify(r2), "ytads.logger.entries.v2") !== true) throw Error("privacy-index-failed");
      }
      if (n.write("structure-only-v1", e3) !== true) throw Error("privacy-marker-failed");
    }
    function ytDiagnosticSanitize(e3) {
      if (!e3) return e3;
      var t3 = /(?:[a-z_]+\.eml-fe\|[0-9a-f]{16}|skip_ad_on_block|googleadservices\.com\/pagead\/|youtube\.com\/pagead\/|yt-ads-web-view-id|FEwhat_to_watch|FEsubscriptions|FEshorts)/g;
      function labels(e4) {
        return (String(e4).match(t3) || []).map(function(e5) {
          return e5.replace(/\|[0-9a-f]{16}$/, "|0000000000000000");
        });
      }
      function url(e4) {
        var t4 = /^(https?:\/\/[^/?#]+)(\/[^?#]*)?/.exec(String(e4 || ""));
        return t4 ? t4[1] + (t4[2] || "/") : "[removed]";
      }
      function headers(e4) {
        var t4 = {};
        Object.keys(e4 || {}).forEach(function(r3) {
          var n2 = String(e4[r3]);
          if (/^(content-type|content-length|content-encoding|accept-encoding)$/i.test(r3) && /^[a-z0-9\s/.,;+_=\-]{0,160}$/i.test(n2) || /^transfer-encoding$/i.test(r3) && /^(?:chunked|gzip|deflate|br|identity)(?:,\s*(?:chunked|gzip|deflate|br|identity))*$/i.test(n2) || /^accept-ranges$/i.test(r3) && /^(?:bytes|none)$/i.test(n2) || /^content-range$/i.test(r3) && /^bytes (?:\d+-\d+|\*)\/(?:\d+|\*)$/.test(n2)) t4[r3] = n2;
        });
        return t4;
      }
      function decode(e4) {
        var t4 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", r3 = [], n2 = 0, a2 = 0;
        for (var i2 = 0; i2 < e4.length && e4[i2] !== "="; i2++) {
          var o2 = t4.indexOf(e4[i2]);
          if (o2 < 0) throw Error("base64");
          n2 = n2 << 6 | o2;
          a2 += 6;
          if (a2 >= 8) {
            a2 -= 8;
            r3.push(n2 >>> a2 & 255);
          }
        }
        return new Uint8Array(r3);
      }
      var r2 = 0;
      function proto(e4, t4) {
        if (t4 > 32 || r2 > 3e4) return { bytes: e4.length, omitted: true };
        var n2 = 0, a2 = [];
        function integer() {
          var t5 = 0, r3 = 1;
          for (var a3 = 0; a3 < 10 && n2 < e4.length; a3++) {
            var i3 = e4[n2++];
            t5 += (i3 & 127) * r3;
            if (i3 < 128) return t5;
            r3 *= 128;
          }
          throw Error("varint");
        }
        while (n2 < e4.length) {
          if (++r2 > 3e4) throw Error("limit");
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
            var c = integer();
            if (!Number.isSafeInteger(c) || c < 0 || c > e4.length - n2) throw Error("length");
            var d = e4.subarray(n2, n2 + c);
            n2 += c;
            u2.bytes = c;
            try {
              u2.fields = proto(d, t4 + 1);
            } catch (e5) {
              var p = "";
              for (var g = 0; g < d.length; g++) p += d[g] >= 32 && d[g] < 127 ? String.fromCharCode(d[g]) : " ";
              u2.markers = labels(p);
            }
          } else throw Error("wire");
          if (n2 > e4.length) throw Error("truncated");
          a2.push(u2);
        }
        return a2;
      }
      function json(e4, t4) {
        if (t4 > 32) return "[omitted]";
        if (typeof e4 === "string") return { chars: e4.length, markers: labels(e4) };
        if (typeof e4 === "number") return e4 === 0 || e4 === 1 ? e4 : "[removed]";
        if (Array.isArray(e4)) return e4.map(function(e5) {
          return json(e5, t4 + 1);
        });
        if (e4 && typeof e4 === "object") {
          var r3 = {};
          Object.keys(e4).forEach(function(n2) {
            if (!/token|cookie|auth|visitor|account|signature|clientkey|encryptkey|trackingparams|clicktracking/i.test(n2) && /^[a-zA-Z_][a-zA-Z0-9_]{0,80}$/.test(n2)) r3[n2] = json(e4[n2], t4 + 1);
          });
          return r3;
        }
        return e4;
      }
      function body(t4, r3, n2) {
        if (!t4 || t4.reference || !t4.available) return t4;
        var a2 = { available: false, reason: "privacy-structure-only", bytes: t4.bytes, redacted: true };
        if (!n2 && /^(config|log_event|initplayback|ump)$/.test(e3.endpoint)) return a2;
        try {
          var i2 = t4.encoding === "base64" ? decode(t4.data) : null;
          if (i2) {
            try {
              var o2 = typeof TextDecoder === "function" && (i2[0] === 123 || i2[0] === 91) ? new TextDecoder("utf-8", { fatal: true }).decode(i2) : null;
              a2.structure = o2 ? json(JSON.parse(o2), 0) : proto(i2, 0);
            } catch (e4) {
              a2.structure = { bytes: i2.length, omitted: true };
            }
          } else a2.structure = json(JSON.parse(t4.data), 0);
        } catch (e4) {
          a2.structure = { omitted: true };
        }
        return a2;
      }
      ["request", "requestAfter", "requestInner", "requestInnerAfter", "responseBefore", "responseAfter"].forEach(function(t4) {
        var r3 = e3[t4];
        if (!r3) return;
        var n2 = {};
        ["status", "method", "synthetic", "changed", "transportHeadersRecomputedByLoon"].forEach(function(e4) {
          if (r3[e4] !== void 0) n2[e4] = r3[e4];
        });
        if (r3.url) n2.url = url(r3.url);
        if (r3.headers) n2.headers = headers(r3.headers);
        if (r3.headerOverrides) n2.headerOverrides = headers(r3.headerOverrides);
        n2.body = body(r3.body, t4 === "request" || t4 === "requestAfter", t4 === "requestInner" || t4 === "requestInnerAfter");
        e3[t4] = n2;
      });
      if (e3.processing && e3.processing.exception) e3.processing.exception = { code: "processing-failed" };
      e3.privacy = "structure-only-v1";
      return e3;
    }
    (function() {
      "use strict";
      var o2 = typeof e2 !== "undefined" ? String(e2.url || "") : "";
      var s2 = typeof t2 !== "undefined";
      if (/\/youtubei\/v1\/(?:config|log_event)(?:\?[^#]*)?$/i.test(o2)) {
        (function() {
          "use strict";
          var o3 = "1.0.1";
          var s3 = "YouTubeConfig";
          var u2 = "ytads.onesie.youtube.v1";
          var l = "ytads.logger.config.v1";
          var f = "ytads.logger.entries.v2";
          var c = 2097152;
          var d = 3e4;
          var p = typeof r === "object" && r ? r : {};
          p.log_level = String(p.log_level || "info").toLowerCase();
          if (typeof p.capture_raw === "undefined") p.capture_raw = p.log_enabled;
          var g = flag(p.script_debug);
          var y = /^https:\/\/(?:youtubei(?:-att)?\.googleapis\.com|(?:www\.|m\.)?youtube\.com)\/youtubei\/v1\/(config|log_event)(?:\?[^#]*)?$/i;
          function flag(e3) {
            return e3 === true || e3 === "true";
          }
          function fail(e3) {
            var t3 = new Error(e3);
            t3.ytNoAdsCode = e3;
            throw t3;
          }
          function bytesOf(e3) {
            if (e3 instanceof Uint8Array) return e3;
            if (e3 instanceof ArrayBuffer) return new Uint8Array(e3);
            if (ArrayBuffer.isView(e3)) return new Uint8Array(e3.buffer, e3.byteOffset, e3.byteLength);
            return null;
          }
          function header(e3, t3) {
            var r2 = Object.keys(e3 || {}), n2 = t3.toLowerCase();
            for (var a2 = 0; a2 < r2.length; a2++) if (r2[a2].toLowerCase() === n2) return String(e3[r2[a2]] || "");
            return "";
          }
          function isYouTubeApp() {
            var t3 = header(typeof e2 !== "undefined" ? e2.headers : {}, "user-agent");
            return /(?:^|\s)com\.google\.ios\.youtube\//i.test(t3) && !/youtubemusic/i.test(t3);
          }
          function readVarint(e3, t3) {
            var r2 = 0, n2 = 1, a2 = 0;
            while (t3.pos < e3.length && a2++ < 10) {
              var i2 = e3[t3.pos++];
              r2 += (i2 & 127) * n2;
              if (!Number.isSafeInteger(r2)) fail("unsafe-varint");
              if (i2 < 128) return r2;
              n2 *= 128;
            }
            fail("invalid-varint");
          }
          function parse(e3, t3) {
            var r2 = { pos: 0 }, n2 = [];
            while (r2.pos < e3.length) {
              if (++t3.fields > d) fail("field-limit");
              var a2 = r2.pos, i2 = readVarint(e3, r2), o4 = Math.floor(i2 / 8), s4 = i2 & 7;
              if (!o4) fail("invalid-tag");
              var u3 = r2.pos, l2 = r2.pos, f2 = null;
              if (s4 === 0) {
                f2 = readVarint(e3, r2);
                l2 = r2.pos;
              } else if (s4 === 1) {
                r2.pos += 8;
                l2 = r2.pos;
              } else if (s4 === 2) {
                var c2 = readVarint(e3, r2);
                if (!Number.isSafeInteger(c2) || c2 < 0 || c2 > e3.length - r2.pos) fail("truncated-field");
                u3 = r2.pos;
                r2.pos += c2;
                l2 = r2.pos;
              } else if (s4 === 5) {
                r2.pos += 4;
                l2 = r2.pos;
              } else fail("unsupported-wire");
              if (r2.pos > e3.length) fail("truncated-field");
              n2.push({ no: o4, wire: s4, start: a2, end: r2.pos, dataStart: u3, dataEnd: l2, value: f2 });
            }
            return n2;
          }
          function only(e3, t3, r2) {
            var n2 = null;
            for (var a2 = 0; a2 < e3.length; a2++) if (e3[a2].no === t3 && e3[a2].wire === r2) {
              if (n2) fail("duplicate-schema-field");
              n2 = e3[a2];
            }
            return n2;
          }
          function descend(e3, t3, r2) {
            var n2 = only(parse(e3, r2), t3, 2);
            return n2 ? e3.subarray(n2.dataStart, n2.dataEnd) : null;
          }
          function base64(e3) {
            var t3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", r2 = "";
            for (var n2 = 0; n2 < e3.length; n2 += 3) {
              var a2 = e3[n2], i2 = n2 + 1 < e3.length ? e3[n2 + 1] : 0, o4 = n2 + 2 < e3.length ? e3[n2 + 2] : 0;
              r2 += t3[a2 >> 2] + t3[(a2 & 3) << 4 | i2 >> 4] + (n2 + 1 < e3.length ? t3[(i2 & 15) << 2 | o4 >> 6] : "=") + (n2 + 2 < e3.length ? t3[o4 & 63] : "=");
            }
            return r2;
          }
          function extractConfig(e3) {
            var t3 = bytesOf(e3);
            if (!t3 || !t3.length || t3.length > c) fail("unsupported-body");
            var r2 = { fields: 0 }, n2 = t3;
            var a2 = [1, 16, 7, 138536474, 146311580];
            for (var i2 = 0; i2 < a2.length; i2++) {
              n2 = descend(n2, a2[i2], r2);
              if (!n2) return null;
            }
            var o4 = parse(n2, r2);
            var s4 = only(o4, 1, 2), u3 = only(o4, 2, 2);
            if (!s4 || !u3 || s4.dataEnd === s4.dataStart || u3.dataEnd === u3.dataStart) fail("incomplete-onesie-config");
            if (s4.dataEnd - s4.dataStart > 1024 || u3.dataEnd - u3.dataStart > 1024) fail("oversized-onesie-key");
            var l2 = only(o4, 3, 0), f2 = only(o4, 30, 0);
            var d2 = l2 && l2.value > 0 && l2.value <= 604800 ? l2.value : 3600;
            var p2 = Date.now();
            return { schema: 1, platform: "youtube", clientKey: base64(n2.subarray(s4.dataStart, s4.dataEnd)), encryptKey: base64(n2.subarray(u3.dataStart, u3.dataEnd)), capturedAt: p2, expiresAt: p2 + d2 * 1e3, lifetimeSeconds: d2, useHotConfig: !!(f2 && f2.value) };
          }
          function readState() {
            if (typeof n === "undefined") return null;
            try {
              var e3 = n.read(u2), t3 = e3 && e3.length <= 8192 ? JSON.parse(e3) : null;
              if (!t3 || t3.schema !== 1 || t3.platform !== "youtube" || typeof t3.clientKey !== "string" || typeof t3.encryptKey !== "string") return null;
              if (!t3.clientKey.length || !t3.encryptKey.length || t3.clientKey.length > 1368 || t3.encryptKey.length > 1368) return null;
              if (!Number.isFinite(t3.expiresAt) || t3.expiresAt <= Date.now()) {
                n.write(void 0, u2);
                return null;
              }
              return t3;
            } catch (e4) {
              return null;
            }
          }
          function writeState(e3) {
            if (typeof n === "undefined") return false;
            var t3 = JSON.stringify(e3);
            return t3.length <= 8192 && n.write(t3, u2) === true;
          }
          function filteredHeaders(e3, t3) {
            var r2 = {}, n2 = false;
            Object.keys(e3 || {}).forEach(function(a2) {
              var i2 = a2.toLowerCase();
              if (i2 === "content-encoding" || t3 && i2 === "x-youtube-hot-hash-data") n2 = true;
              else r2[a2] = e3[a2];
            });
            return { headers: r2, changed: n2 };
          }
          function utf8Size(e3) {
            return unescape(encodeURIComponent(e3)).length;
          }
          function checksum(e3) {
            var t3 = 2166136261;
            for (var r2 = 0; r2 < e3.length; r2++) {
              t3 ^= e3.charCodeAt(r2);
              t3 = Math.imul(t3, 16777619);
            }
            return "fnv1a32-utf16:" + ("00000000" + (t3 >>> 0).toString(16)).slice(-8);
          }
          function captureBody(e3) {
            if (e3 === void 0 || e3 === null) return { available: false, reason: "not-provided-by-runtime" };
            if (typeof e3 === "string") return { available: true, encoding: "utf8-text", bytes: utf8Size(e3), data: e3 };
            var t3 = bytesOf(e3);
            return t3 ? { available: true, encoding: "base64", bytes: t3.length, data: base64(t3) } : { available: false, reason: "unsupported-runtime-body-type" };
          }
          function logConfig() {
            if (!flag(p.log_enabled) || typeof n === "undefined") return null;
            try {
              var e3 = n.read(l), t3 = e3 && e3.length <= 2048 ? JSON.parse(e3) : null;
              return t3 && t3.enabled === true && typeof t3.session === "string" && /^[a-z0-9-]{1,80}$/.test(t3.session) ? t3 : null;
            } catch (e4) {
              return null;
            }
          }
          function append(e3, t3) {
            var r2 = logConfig(), a2 = [];
            if (!r2) return false;
            try {
              if (!ytDiagnosticShouldRecord(e3, t3, p.log_level)) return true;
              ytDiagnosticPurgeLegacy();
              var i2 = n.read(f), o4 = i2 ? JSON.parse(i2) : null;
              var s4 = o4 && o4.session === r2.session && Array.isArray(o4.entries) ? o4 : { session: r2.session, entries: [], captureBytes: 0 };
              if (s4.entries.length >= 600) return false;
              var u3 = t3 ? JSON.stringify(ytDiagnosticSanitize(t3)) : null, l2 = u3 ? utf8Size(u3) : 0;
              var c2 = [16, 32, 64].indexOf(Number(p.capture_budget)) >= 0 ? Number(p.capture_budget) * 1048576 : 33554432;
              if ((s4.captureBytes || 0) + l2 > c2 || l2 > 33554432) return false;
              if (u3) {
                var d2 = [];
                for (var g2 = 0; g2 < u3.length; g2 += 131072) d2.push(u3.slice(g2, g2 + 131072));
                if (d2.length > 256) return false;
                var y2 = "ytads.capture." + r2.session + "." + t3.id + ".";
                e3.captureRef = { prefix: y2, chunks: d2.length, chars: u3.length, storedBytes: l2, checksum: checksum(u3) };
                for (var v2 = 0; v2 < d2.length; v2++) {
                  var h2 = y2 + v2;
                  if (n.write(d2[v2], h2) !== true) fail("capture-write-failed");
                  a2.push(h2);
                }
              }
              var m2 = { session: r2.session, entries: s4.entries.concat([e3]), captureBytes: (s4.captureBytes || 0) + l2 };
              var b2 = JSON.stringify(m2);
              if (utf8Size(b2) > 131072 || ytDiagnosticCommitEntry(m2, c2) !== true) fail("index-write-failed");
              return true;
            } catch (e4) {
              for (var w2 = 0; w2 < a2.length; w2++) try {
                n.write(void 0, a2[w2]);
              } catch (e5) {
              }
              return false;
            }
          }
          function record(r2, n2, a2, u3) {
            var l2 = (/* @__PURE__ */ new Date()).toISOString(), f2 = typeof t2 === "undefined" ? "request" : "response";
            if (flag(p.capture_raw) && typeof e2 !== "undefined") {
              var c2 = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
              var d2 = { schema: 1, id: c2, time: l2, source: s3, version: o3, phase: f2, endpoint: a2, runtime: typeof $loon === "string" ? $loon : null, correlation: { urlMethodHash: checksum((e2.method || "GET") + " " + e2.url), exactPairing: false }, request: { url: e2.url, method: e2.method || "GET", headers: e2.headers || {}, h2_trailers: e2.h2_trailers || {}, body: captureBody(e2.body) }, processing: { exception: null, executionScript: s3, elapsedMs: Date.now() - i, messages: [r2], arguments: { onesie_enabled: true, log_level: p.log_level || "info" } } };
              if (typeof t2 !== "undefined") {
                d2.responseBefore = { status: t2.status, headers: t2.headers || {}, h2_trailers: t2.h2_trailers || {}, body: captureBody(t2.body) };
                d2.responseAfter = { changed: false, status: t2.status, headerOverrides: null, transportHeadersRecomputedByLoon: true, body: { reference: "responseBefore.body" } };
              }
              append({ source: s3, version: o3, endpoint: a2, level: "debug", time: l2, phase: f2, message: "development capture: " + f2 + " changed=" + !!(u3 && Object.keys(u3).length) }, d2);
            } else {
              var y2 = { debug: 0, info: 1, warn: 2, error: 3 }, v2 = Object.prototype.hasOwnProperty.call(y2, p.log_level) ? p.log_level : "info";
              if (v2 === "info" || y2[n2] >= y2[v2]) append({ source: s3, version: o3, endpoint: a2, level: n2, time: l2, phase: f2, message: r2 }, null);
            }
            if (g && typeof console !== "undefined") console.log("[" + s3 + " " + o3 + "] " + a2 + " " + r2);
          }
          var v = {};
          var h = typeof e2 !== "undefined" ? y.exec(e2.url || "") : null;
          var m = h ? h[1].toLowerCase() : "unknown";
          if (h && isYouTubeApp()) {
            try {
              if (typeof t2 === "undefined" && m === "log_event") {
                var b = readState(), w = filteredHeaders(e2.headers, !b);
                if (w.changed) v = { headers: w.headers };
                record((b ? "active" : "refresh-requested") + ": transport_headers=" + (w.changed ? "updated" : "unchanged"), b ? "debug" : "info", m, v);
              } else if (typeof t2 !== "undefined" && Number(t2.status || 200) >= 200 && Number(t2.status || 200) < 300) {
                var x = extractConfig(t2.body);
                if (x) {
                  if (!writeState(x)) fail("config-store-failed");
                  record("updated: lifetime_seconds=" + x.lifetimeSeconds + " hot_config=" + x.useHotConfig, "info", m, v);
                } else record("pass: onesie config absent", "debug", m, v);
              }
            } catch (e3) {
              record("pass: " + (e3 && e3.message || "parse-failed"), "warn", m, v);
              v = {};
            }
          }
          a(v);
        })();
      } else {
        a({});
      }
    })();
  }, e);
}
export {
  YouTubeConfig
};
