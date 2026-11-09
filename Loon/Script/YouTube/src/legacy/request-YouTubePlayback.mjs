// devchristian1337; extracted from the previously vendored bundle. See SOURCE.md.
import { ytRuntimeInvoke } from "../legacy-runtime.mjs";
function YouTubePlayback(e, t) {
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
    function ytDiagnosticQuality(e3, t3) {
      var r2 = { schema: 1, purpose: "quality-research", actualRenderedQuality: "not-observed" };
      function number(e4, t4) {
        return typeof e4 === "number" && Number.isSafeInteger(e4) && e4 >= 0 && e4 <= t4 ? e4 : null;
      }
      function bytes(e4, r3) {
        if (!e4 || e4.available !== true || !Number.isSafeInteger(e4.bytes) || e4.bytes > r3) return null;
        return e4.memoryBytes instanceof Uint8Array ? e4.memoryBytes : e4.encoding === "base64" ? t3(e4.data) : null;
      }
      function fields(e4) {
        var t4 = 0, r3 = [];
        function integer() {
          var r4 = 0, n4 = 1;
          for (var a4 = 0; a4 < 10 && t4 < e4.length; a4++) {
            var i4 = e4[t4++];
            if (a4 === 9 && i4 > 1) throw Error("varint");
            r4 += (i4 & 127) * n4;
            if (i4 < 128) return Number.isSafeInteger(r4) ? r4 : null;
            n4 *= 128;
          }
          throw Error("varint");
        }
        while (t4 < e4.length) {
          if (r3.length >= 512) throw Error("fields-limit");
          var n3 = integer();
          if (!n3 || n3 > 4294967295) throw Error("tag");
          var a3 = Math.floor(n3 / 8), i3 = n3 % 8, o3 = { field: a3, wire: i3 };
          if (i3 === 0) o3.value = integer();
          else if (i3 === 1 || i3 === 5) t4 += i3 === 1 ? 8 : 4;
          else if (i3 === 2) {
            var s3 = integer();
            if (s3 === null || s3 > e4.length - t4) throw Error("length");
            o3.bytes = e4.subarray(t4, t4 + s3);
            t4 += s3;
          } else throw Error("wire");
          if (t4 > e4.length) throw Error("truncated");
          r3.push(o3);
        }
        return r3;
      }
      function abr(e4) {
        var t4 = fields(e4), r3 = { status: "schema-candidate", schema: "LuanRT/googlevideo VideoPlaybackAbrRequest", iosSchemaVerified: false }, n3 = {}, a3 = { initialization: [], audio: [], video: [] }, i3 = false;
        var o3 = { 13: ["timeSinceLastManualSelectionMs", 864e5], 16: ["lastManualSelectedResolution", 8640], 18: ["viewportWidth", 32768], 19: ["viewportHeight", 32768], 20: ["bitrateCapBytesPerSecond", 1e9], 21: ["stickyResolution", 8640], 23: ["bandwidthEstimate", 1e12], 26: ["videoQualitySetting", 3], 30: ["dataSaverMode", 1], 62: ["supportsQualityConstraints", 1] };
        for (var s3 = 0; s3 < t4.length; s3++) {
          var u3 = t4[s3];
          if (u3.field === 1 && u3.wire === 2) {
            var l2 = fields(u3.bytes);
            for (var f = 0; f < l2.length; f++) {
              var c = l2[f], d = o3[c.field], p = d && c.wire === 0 ? number(c.value, d[1]) : null;
              if (p !== null) {
                n3[d[0]] = p;
                i3 = true;
              }
            }
          }
          var g = u3.field === 2 ? "initialization" : u3.field === 16 ? "audio" : u3.field === 17 ? "video" : null;
          if (g && u3.wire === 2 && a3[g].length < 64) {
            var y = fields(u3.bytes);
            for (var v = 0; v < y.length; v++) if (y[v].field === 1 && y[v].wire === 0) {
              var h = number(y[v].value, 65535);
              if (h !== null && h > 0 && a3[g].indexOf(h) < 0) a3[g].push(h);
            }
          }
          if ((u3.field === 22 || u3.field === 23) && u3.wire === 0) {
            var m = number(u3.value, 65535);
            if (m !== null) r3[u3.field === 22 ? "lastVideoItag" : "lastAudioItag"] = m;
          }
        }
        if (!i3) return { status: "unrecognized-schema" };
        r3.clientAbrState = n3;
        r3.formatItags = a3;
        return r3;
      }
      function formats(e4) {
        var t4 = e4 && e4.streamingData || e4 && e4.playerResponse && e4.playerResponse.streamingData;
        if (!t4) return { status: "no-json-streaming-data" };
        var r3 = { status: "observed-json-formats", formats: [] }, n3 = { itag: 65535, width: 32768, height: 32768, fps: 240, bitrate: 1e9, averageBitrate: 1e9, audioSampleRate: 384e3, audioChannels: 32 };
        var a3 = [t4.formats, t4.adaptiveFormats];
        for (var i3 = 0; i3 < a3.length; i3++) {
          var o3 = a3[i3];
          if (!Array.isArray(o3)) continue;
          for (var s3 = 0; s3 < o3.length && r3.formats.length < 128; s3++) {
            var u3 = o3[s3];
            if (!u3 || typeof u3 !== "object") continue;
            var l2 = { source: i3 === 0 ? "formats" : "adaptiveFormats" };
            for (var f in n3) {
              var c = number(u3[f], n3[f]);
              if (c !== null) l2[f] = c;
            }
            if (typeof u3.qualityLabel === "string" && /^(?:144|240|360|480|720|1080|1440|2160|2880|4320|8640)p(?:48|50|60|90|120)?$/.test(u3.qualityLabel)) l2.qualityLabel = u3.qualityLabel;
            if (typeof u3.mimeType === "string") {
              var d = /^(video|audio)\/(mp4|webm)(?:\s*;|$)/.exec(u3.mimeType);
              if (d) l2.container = d[1] + "/" + d[2];
            }
            l2.hasDirectUrl = typeof u3.url === "string" && /^https:\/\//.test(u3.url);
            l2.hasCipher = typeof u3.signatureCipher === "string" || typeof u3.cipher === "string";
            if (Object.keys(l2).length > 3) r3.formats.push(l2);
          }
        }
        return r3;
      }
      try {
        var n2 = e3.request || {}, a2 = String(n2.url || "");
        if (e3.endpoint === "ump") {
          var i2 = /[?&]itag=(\d{1,5})(?:&|$)/.exec(a2);
          if (i2 && Number(i2[1]) > 0 && Number(i2[1]) <= 65535) r2.urlItag = Number(i2[1]);
          if (e3.phase === "request" && String(n2.method || "GET").toUpperCase() === "POST") {
            var o2 = bytes(n2.body, 262144);
            r2.abr = o2 ? abr(o2) : { status: "request-body-unavailable-or-too-large" };
          }
        }
        if (/^(player|get_watch)$/.test(e3.endpoint) && e3.phase === "response") {
          var s2 = e3.responseBefore && e3.responseBefore.body, u2 = null;
          if (s2 && s2.available === true && s2.bytes <= 4194304) {
            if (s2.encoding === "utf8-text") u2 = s2.data;
            else {
              var l = bytes(s2, 4194304);
              if (l && (l[0] === 123 || l[0] === 91) && typeof TextDecoder === "function") u2 = new TextDecoder("utf-8", { fatal: true }).decode(l);
            }
          }
          r2.player = u2 ? formats(JSON.parse(u2)) : { status: "binary-player-schema-unverified-or-body-unavailable" };
        }
      } catch (e4) {
        r2.analysisStatus = "unsupported-or-malformed-body";
      }
      return r2;
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
        Object.keys(e4 || {}).forEach(function(r2) {
          var n3 = String(e4[r2]);
          if (/^(content-type|content-length|content-encoding|accept-encoding)$/i.test(r2) && /^[a-z0-9\s/.,;+_=\-]{0,160}$/i.test(n3) || /^transfer-encoding$/i.test(r2) && /^(?:chunked|gzip|deflate|br|identity)(?:,\s*(?:chunked|gzip|deflate|br|identity))*$/i.test(n3) || /^accept-ranges$/i.test(r2) && /^(?:bytes|none)$/i.test(n3) || /^content-range$/i.test(r2) && /^bytes (?:\d+-\d+|\*)\/(?:\d+|\*)$/.test(n3)) t4[r2] = n3;
        });
        return t4;
      }
      function decode(e4) {
        var t4 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", r2 = [], n3 = 0, a2 = 0;
        for (var i2 = 0; i2 < e4.length && e4[i2] !== "="; i2++) {
          var o2 = t4.indexOf(e4[i2]);
          if (o2 < 0) throw Error("base64");
          n3 = n3 << 6 | o2;
          a2 += 6;
          if (a2 >= 8) {
            a2 -= 8;
            r2.push(n3 >>> a2 & 255);
          }
        }
        return new Uint8Array(r2);
      }
      var n2 = 0;
      function proto(e4, t4) {
        if (t4 > 32 || n2 > 3e4) return { bytes: e4.length, omitted: true };
        var r2 = 0, a2 = [];
        function integer() {
          var t5 = 0, n3 = 1;
          for (var a3 = 0; a3 < 10 && r2 < e4.length; a3++) {
            var i3 = e4[r2++];
            t5 += (i3 & 127) * n3;
            if (i3 < 128) return t5;
            n3 *= 128;
          }
          throw Error("varint");
        }
        while (r2 < e4.length) {
          if (++n2 > 3e4) throw Error("limit");
          var i2 = integer(), o2 = Math.floor(i2 / 8), s2 = i2 % 8;
          if (!o2) throw Error("tag");
          var u2 = { field: o2, wire: s2 };
          if (s2 === 0) {
            var l = integer();
            u2.value = l === 0 || l === 1 ? l : "[removed]";
          } else if (s2 === 1 || s2 === 5) {
            var f = s2 === 1 ? 8 : 4;
            r2 += f;
            u2.bytes = f;
          } else if (s2 === 2) {
            var c = integer();
            if (!Number.isSafeInteger(c) || c < 0 || c > e4.length - r2) throw Error("length");
            var d = e4.subarray(r2, r2 + c);
            r2 += c;
            u2.bytes = c;
            try {
              u2.fields = proto(d, t4 + 1);
            } catch (e5) {
              var p = "";
              for (var g = 0; g < d.length; g++) p += d[g] >= 32 && d[g] < 127 ? String.fromCharCode(d[g]) : " ";
              u2.markers = labels(p);
            }
          } else throw Error("wire");
          if (r2 > e4.length) throw Error("truncated");
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
          var r2 = {};
          Object.keys(e4).forEach(function(n3) {
            if (!/token|cookie|auth|visitor|account|signature|clientkey|encryptkey|trackingparams|clicktracking/i.test(n3) && /^[a-zA-Z_][a-zA-Z0-9_]{0,80}$/.test(n3)) r2[n3] = json(e4[n3], t4 + 1);
          });
          return r2;
        }
        return e4;
      }
      function body(t4, r2, n3) {
        if (!t4 || t4.reference || !t4.available) return t4;
        var a2 = { available: false, reason: "privacy-structure-only", bytes: t4.bytes, redacted: true };
        if (!n3 && /^(config|log_event|initplayback|ump)$/.test(e3.endpoint)) return a2;
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
      if (!e3.privacy && typeof $loon === "string" && typeof r === "object" && r && (r.log_enabled === true || r.log_enabled === "true") && (r.quality_research === true || r.quality_research === "true") && /^(ump|player|get_watch)$/.test(e3.endpoint)) {
        e3.qualityResearch = ytDiagnosticQuality(e3, decode);
      }
      ["request", "requestAfter", "requestInner", "requestInnerAfter", "responseBefore", "responseAfter"].forEach(function(t4) {
        var r2 = e3[t4];
        if (!r2) return;
        var n3 = {};
        ["status", "method", "synthetic", "changed", "transportHeadersRecomputedByLoon"].forEach(function(e4) {
          if (r2[e4] !== void 0) n3[e4] = r2[e4];
        });
        if (r2.url) n3.url = url(r2.url);
        if (r2.headers) n3.headers = headers(r2.headers);
        if (r2.headerOverrides) n3.headerOverrides = headers(r2.headerOverrides);
        n3.body = body(r2.body, t4 === "request" || t4 === "requestAfter", t4 === "requestInner" || t4 === "requestInnerAfter");
        e3[t4] = n3;
      });
      if (e3.processing && e3.processing.exception) e3.processing.exception = { code: "processing-failed" };
      e3.privacy = "structure-only-v1";
      return e3;
    }
    (function() {
      "use strict";
      var o2 = typeof e2 !== "undefined" ? String(e2.url || "") : "";
      var s2 = typeof t2 !== "undefined";
      if (!s2 && /\/youtubei\/v1\/player\/ad_break(?:\?[^#]*)?$/i.test(o2)) {
        (function() {
          "use strict";
          var o3 = "1.0.0";
          var s3 = "YouTubePlayback";
          var u2 = "ad_break";
          var l = "ytads.logger.config.v1";
          var f = "ytads.logger.entries.v2";
          var c = /^https:\/\/(?:youtubei(?:-att)?\.googleapis\.com|(?:www\.|m\.|music\.)?youtube\.com)\/youtubei\/v1\/player\/ad_break(?:\?[^#]*)?$/i;
          var d = typeof r === "object" && r ? r : {};
          d.log_level = String(d.log_level || "info").toLowerCase();
          if (typeof d.capture_raw === "undefined") d.capture_raw = d.log_enabled;
          var p = d.block_ad_break !== false && d.block_ad_break !== "false";
          var g = d.script_debug === true || d.script_debug === "true";
          function flag(e3) {
            return e3 === true || e3 === "true";
          }
          function utf8Size(e3) {
            var t3 = 0;
            for (var r2 = 0; r2 < e3.length; r2++) {
              var n2 = e3.charCodeAt(r2);
              if (n2 < 128) t3++;
              else if (n2 < 2048) t3 += 2;
              else if (n2 >= 55296 && n2 <= 56319 && r2 + 1 < e3.length && e3.charCodeAt(r2 + 1) >= 56320 && e3.charCodeAt(r2 + 1) <= 57343) {
                t3 += 4;
                r2++;
              } else t3 += 3;
            }
            return t3;
          }
          function checksum(e3) {
            var t3 = 2166136261;
            for (var r2 = 0; r2 < e3.length; r2++) {
              t3 ^= e3.charCodeAt(r2);
              t3 = Math.imul(t3, 16777619);
            }
            return "fnv1a32-utf16:" + ("00000000" + (t3 >>> 0).toString(16)).slice(-8);
          }
          function base64(e3) {
            var t3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", r2 = "";
            for (var n2 = 0; n2 < e3.length; n2 += 3) {
              var a2 = e3[n2], i2 = n2 + 1 < e3.length ? e3[n2 + 1] : 0, o4 = n2 + 2 < e3.length ? e3[n2 + 2] : 0;
              r2 += t3[a2 >> 2] + t3[(a2 & 3) << 4 | i2 >> 4] + (n2 + 1 < e3.length ? t3[(i2 & 15) << 2 | o4 >> 6] : "=") + (n2 + 2 < e3.length ? t3[o4 & 63] : "=");
            }
            return r2;
          }
          function captureBody(e3) {
            if (e3 === void 0 || e3 === null) return { available: false, reason: "not-provided-by-runtime" };
            if (typeof e3 === "string") return { available: true, encoding: "utf8-text", bytes: utf8Size(e3), data: e3 };
            var t3 = e3 instanceof Uint8Array ? e3 : e3 instanceof ArrayBuffer ? new Uint8Array(e3) : ArrayBuffer.isView(e3) ? new Uint8Array(e3.buffer, e3.byteOffset, e3.byteLength) : null;
            return t3 ? { available: true, encoding: "base64", bytes: t3.length, data: base64(t3) } : { available: false, reason: "unsupported-runtime-body-type" };
          }
          function loggerConfig() {
            if (!flag(d.log_enabled) || typeof n === "undefined") return null;
            var e3 = n.read(l), t3 = e3 && e3.length <= 2048 ? JSON.parse(e3) : null;
            return t3 && t3.enabled === true && typeof t3.session === "string" && /^[a-z0-9-]{1,80}$/.test(t3.session) ? t3 : null;
          }
          function append(e3, t3) {
            var r2 = [];
            try {
              var a2 = loggerConfig();
              if (!a2) return false;
              if (!ytDiagnosticShouldRecord(e3, t3, d.log_level)) return true;
              ytDiagnosticPurgeLegacy();
              var i2 = n.read(f);
              if (i2 && utf8Size(i2) > 131072) return false;
              var o4 = i2 ? JSON.parse(i2) : null;
              var s4 = o4 && o4.session === a2.session && Array.isArray(o4.entries) ? o4 : { session: a2.session, entries: [], captureBytes: 0 };
              if (s4.entries.length >= 600) return false;
              var u3 = t3 ? JSON.stringify(ytDiagnosticSanitize(t3)) : null;
              var l2 = u3 ? utf8Size(u3) : 0;
              var c2 = [16, 32, 64].indexOf(Number(d.capture_budget)) >= 0 ? Number(d.capture_budget) * 1048576 : 33554432;
              if (l2 > 33554432 || (s4.captureBytes || 0) + l2 > c2) return false;
              if (u3) {
                var p2 = [];
                for (var g2 = 0; g2 < u3.length; ) {
                  var y2 = Math.min(g2 + 131072, u3.length);
                  if (y2 < u3.length && u3.charCodeAt(y2 - 1) >= 55296 && u3.charCodeAt(y2 - 1) <= 56319 && u3.charCodeAt(y2) >= 56320 && u3.charCodeAt(y2) <= 57343) y2--;
                  p2.push(u3.slice(g2, y2));
                  g2 = y2;
                }
                if (p2.length > 256) return false;
                var v = "ytads.capture." + a2.session + "." + t3.id + ".";
                e3.captureRef = { prefix: v, chunks: p2.length, chars: u3.length, storedBytes: l2, checksum: checksum(u3) };
                for (var h = 0; h < p2.length; h++) {
                  var m = v + h;
                  if (n.write(p2[h], m) !== true) throw new Error("capture-write-failed");
                  r2.push(m);
                }
              }
              var b = { session: a2.session, entries: s4.entries.concat([e3]), captureBytes: (s4.captureBytes || 0) + l2 };
              var w = JSON.stringify(b);
              if (utf8Size(w) > 131072 || ytDiagnosticCommitEntry(b, c2) !== true) throw new Error("index-write-failed");
              return true;
            } catch (e4) {
              for (var x = 0; x < r2.length; x++) try {
                n.write(void 0, r2[x]);
              } catch (e5) {
              }
              return false;
            }
          }
          function record(t3) {
            var r2 = (/* @__PURE__ */ new Date()).toISOString();
            if (flag(d.capture_raw) && typeof e2 !== "undefined") {
              var n2 = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
              var a2 = { url: e2.url, method: e2.method || "GET", headers: e2.headers || {}, h2_trailers: e2.h2_trailers || {}, body: captureBody(e2.body) };
              var l2 = { schema: 1, id: n2, time: r2, source: s3, version: o3, phase: "request", endpoint: u2, runtime: typeof $loon === "string" ? $loon : null, correlation: { urlMethodHash: checksum(a2.method + " " + a2.url), exactPairing: true }, request: a2, processing: { executionScript: s3, elapsedMs: Date.now() - i, messages: [t3], arguments: { block_ad_break: p, log_level: d.log_level || "info" } }, responseAfter: { changed: true, synthetic: true, status: 200, headerOverrides: { "Content-Type": "application/x-protobuf", "Cache-Control": "no-store" }, transportHeadersRecomputedByLoon: true, body: { available: true, encoding: "base64", bytes: 0, data: "" } } };
              append({ source: s3, version: o3, endpoint: u2, level: "debug", time: r2, phase: "request", message: "development capture: blocked=true" }, l2);
            } else {
              append({ source: s3, version: o3, endpoint: u2, level: "info", time: r2, message: t3 }, null);
            }
            if (g && typeof console !== "undefined") console.log("[" + s3 + " " + o3 + "] " + u2 + " " + t3);
          }
          var y = {};
          if (p && typeof e2 !== "undefined" && typeof t2 === "undefined" && c.test(e2.url || "")) {
            record("blocked: empty-protobuf status=200");
            y = { response: { status: 200, headers: { "Content-Type": "application/x-protobuf", "Cache-Control": "no-store" }, body: new Uint8Array(0) } };
          }
          a(y);
        })();
      } else if (!s2 && /\/youtubei\/v1\/(?:player|get_watch)(?:\?[^#]*)?$/i.test(o2)) {
        (function() {
          "use strict";
          var o3 = "1.2.0";
          var s3 = "YouTubePlayback";
          var u2 = "ytads.logger.config.v1";
          var l = "ytads.logger.entries.v2";
          var f = 2097152;
          var c = 3e4;
          var d = typeof r === "object" && r ? r : {};
          d.log_level = String(d.log_level || "info").toLowerCase();
          if (typeof d.capture_raw === "undefined") d.capture_raw = d.log_enabled;
          var p = d.suppress_player_ads !== false && d.suppress_player_ads !== "false";
          var g = d.script_debug === true || d.script_debug === "true";
          function flag(e3) {
            return e3 === true || e3 === "true";
          }
          function endpoint(e3) {
            var t3 = /\/youtubei\/v1\/(player|get_watch)(?:\?[^#]*)?$/i.exec(e3 || "");
            return t3 ? t3[1].toLowerCase() : null;
          }
          function bytesOf(e3) {
            if (e3 instanceof Uint8Array) return e3;
            if (e3 instanceof ArrayBuffer) return new Uint8Array(e3);
            if (ArrayBuffer.isView(e3)) return new Uint8Array(e3.buffer, e3.byteOffset, e3.byteLength);
            return null;
          }
          function fail(e3) {
            throw new Error(e3);
          }
          function readVarint(e3, t3) {
            var r2 = 0, n2 = 1, a2 = 0;
            while (t3.pos < e3.length && a2++ < 10) {
              var i2 = e3[t3.pos++];
              if (n2 <= 9007199254740991) r2 += (i2 & 127) * n2;
              if (i2 < 128) return r2;
              n2 *= 128;
            }
            fail("invalid-varint");
          }
          function parse(e3, t3) {
            var r2 = { pos: 0 }, n2 = [];
            while (r2.pos < e3.length) {
              if (++t3.fields > c) fail("field-limit");
              var a2 = r2.pos, i2 = readVarint(e3, r2), o4 = Math.floor(i2 / 8), s4 = i2 & 7;
              if (!o4) fail("invalid-tag");
              var u3 = r2.pos, l2 = r2.pos;
              if (s4 === 0) {
                readVarint(e3, r2);
                l2 = r2.pos;
              } else if (s4 === 1) {
                r2.pos += 8;
                l2 = r2.pos;
              } else if (s4 === 2) {
                var f2 = readVarint(e3, r2);
                if (!Number.isSafeInteger(f2) || f2 < 0 || f2 > e3.length - r2.pos) fail("truncated-field");
                u3 = r2.pos;
                r2.pos += f2;
                l2 = r2.pos;
              } else if (s4 === 5) {
                r2.pos += 4;
                l2 = r2.pos;
              } else fail("unsupported-wire");
              if (r2.pos > e3.length) fail("truncated-field");
              n2.push({ no: o4, wire: s4, start: a2, end: r2.pos, dataStart: u3, dataEnd: l2 });
            }
            return n2;
          }
          function varint(e3) {
            var t3 = [];
            do {
              var r2 = e3 % 128;
              e3 = Math.floor(e3 / 128);
              t3.push(r2 + (e3 ? 128 : 0));
            } while (e3);
            return new Uint8Array(t3);
          }
          function concat(e3) {
            var t3 = 0, r2, n2 = 0;
            for (r2 = 0; r2 < e3.length; r2++) t3 += e3[r2].length;
            var a2 = new Uint8Array(t3);
            for (r2 = 0; r2 < e3.length; r2++) {
              a2.set(e3[r2], n2);
              n2 += e3[r2].length;
            }
            return a2;
          }
          function message(e3, t3) {
            return concat([varint(e3 * 8 + 2), varint(t3.length), t3]);
          }
          function scalar(e3, t3) {
            return concat([varint(e3 * 8), varint(t3)]);
          }
          function raw(e3, t3) {
            return e3.subarray(t3.start, t3.end);
          }
          function selectedRegion() {
            var e3 = String(d.playback_region || "original").toUpperCase();
            return ["CN", "HK", "TW", "US", "JP", "KR", "SG", "GB", "DE", "RU"].indexOf(e3) >= 0 ? e3 : "";
          }
          function regionClient(e3, t3, r2) {
            var n2 = selectedRegion();
            if (!n2) return { body: e3, changed: false };
            var a2 = parse(e3, t3), i2 = [], o4 = false, s4 = false;
            for (var u3 = 0; u3 < a2.length; u3++) {
              var l2 = a2[u3];
              if (l2.no === 2) {
                if (o4 || l2.wire !== 2) fail("region-schema-mismatch");
                o4 = true;
                var f2 = e3.subarray(l2.dataStart, l2.dataEnd);
                if (f2.length !== 2 || f2[0] !== n2.charCodeAt(0) || f2[1] !== n2.charCodeAt(1)) {
                  i2.push(message(2, new Uint8Array([n2.charCodeAt(0), n2.charCodeAt(1)])));
                  s4 = true;
                } else i2.push(raw(e3, l2));
              } else i2.push(raw(e3, l2));
            }
            if (!o4) {
              i2.push(message(2, new Uint8Array([n2.charCodeAt(0), n2.charCodeAt(1)])));
              s4 = true;
            }
            r2.regionApplied = (r2.regionApplied || 0) + 1;
            return { body: s4 ? concat(i2) : e3, changed: s4 };
          }
          function regionContext(e3, t3, r2) {
            if (!selectedRegion()) return { body: e3, changed: false };
            var n2 = parse(e3, t3), a2 = [], i2 = false, o4 = false;
            for (var s4 = 0; s4 < n2.length; s4++) {
              var u3 = n2[s4];
              if (u3.no === 1) {
                if (i2 || u3.wire !== 2) fail("region-context-schema-mismatch");
                i2 = true;
                var l2 = regionClient(e3.subarray(u3.dataStart, u3.dataEnd), t3, r2);
                a2.push(l2.changed ? message(1, l2.body) : raw(e3, u3));
                o4 = o4 || l2.changed;
              } else a2.push(raw(e3, u3));
            }
            return { body: o4 ? concat(a2) : e3, changed: o4 };
          }
          function regionJson(e3, t3) {
            var r2 = selectedRegion();
            if (!r2 || !e3 || !e3.client || typeof e3.client !== "object" || Array.isArray(e3.client)) return false;
            t3.regionApplied = (t3.regionApplied || 0) + 1;
            if (e3.client.gl === r2) return false;
            e3.client.gl = r2;
            return true;
          }
          function cleanContext(e3, t3, r2) {
            var n2 = regionContext(e3, t3, r2);
            e3 = n2.body;
            var a2 = parse(e3, t3), i2 = [], o4 = n2.changed;
            for (var s4 = 0; s4 < a2.length; s4++) {
              if (a2[s4].no === 9 && a2[s4].wire === 2) {
                r2.contextAdSignals++;
                o4 = true;
              } else i2.push(raw(e3, a2[s4]));
            }
            return { body: o4 ? concat(i2) : e3, changed: o4 };
          }
          function cleanContentPlayback(e3, t3, r2) {
            var n2 = parse(e3, t3), a2 = [], i2 = false, o4 = false;
            for (var s4 = 0; s4 < n2.length; s4++) {
              var u3 = n2[s4];
              if (u3.no === 12 && u3.wire === 2 || u3.no === 25 && u3.wire === 2) {
                r2.playbackAdParams++;
                i2 = true;
              } else if (u3.no === 50 && u3.wire === 0) {
                if (!o4) a2.push(scalar(50, 1));
                o4 = true;
                r2.inlineNoAd++;
                i2 = true;
              } else a2.push(raw(e3, u3));
            }
            if (!o4) {
              a2.push(scalar(50, 1));
              r2.inlineNoAd++;
              i2 = true;
            }
            return { body: i2 ? concat(a2) : e3, changed: i2 };
          }
          function cleanPlaybackContext(e3, t3, r2) {
            var n2 = parse(e3, t3), a2 = [], i2 = false;
            for (var o4 = 0; o4 < n2.length; o4++) {
              var s4 = n2[o4];
              if (s4.no === 1 && s4.wire === 2) {
                var u3 = cleanContentPlayback(e3.subarray(s4.dataStart, s4.dataEnd), t3, r2);
                if (u3.changed) {
                  a2.push(message(1, u3.body));
                  i2 = true;
                } else a2.push(raw(e3, s4));
              } else a2.push(raw(e3, s4));
            }
            return { body: i2 ? concat(a2) : e3, changed: i2 };
          }
          function cleanPlayer(e3, t3, r2) {
            var n2 = parse(e3, t3), a2 = [], i2 = false;
            for (var o4 = 0; o4 < n2.length; o4++) {
              var s4 = n2[o4], u3 = null;
              if (s4.no === 1 && s4.wire === 2) u3 = cleanContext(e3.subarray(s4.dataStart, s4.dataEnd), t3, r2);
              else if (s4.no === 4 && s4.wire === 2) u3 = cleanPlaybackContext(e3.subarray(s4.dataStart, s4.dataEnd), t3, r2);
              if (u3 && u3.changed) {
                a2.push(message(s4.no, u3.body));
                i2 = true;
              } else a2.push(raw(e3, s4));
            }
            return { body: i2 ? concat(a2) : e3, changed: i2 };
          }
          function cleanGetWatch(e3, t3, r2) {
            var n2 = parse(e3, t3), a2 = [], i2 = false;
            for (var o4 = 0; o4 < n2.length; o4++) {
              var s4 = n2[o4], u3 = null;
              if (s4.no === 1 && s4.wire === 2) u3 = cleanContext(e3.subarray(s4.dataStart, s4.dataEnd), t3, r2);
              else if (s4.no === 2 && s4.wire === 2) u3 = cleanPlayer(e3.subarray(s4.dataStart, s4.dataEnd), t3, r2);
              if (u3 && u3.changed) {
                a2.push(message(s4.no, u3.body));
                i2 = true;
              } else a2.push(raw(e3, s4));
            }
            return { body: i2 ? concat(a2) : e3, changed: i2 };
          }
          function cleanJson(e3, t3, r2) {
            function context(e4) {
              regionJson(e4, r2);
              if (e4 && typeof e4 === "object" && Object.prototype.hasOwnProperty.call(e4, "adSignalsInfo")) {
                delete e4.adSignalsInfo;
                r2.contextAdSignals++;
              }
            }
            function player(e4) {
              if (!e4 || typeof e4 !== "object") return;
              context(e4.context);
              var t4 = e4.playbackContext && e4.playbackContext.contentPlaybackContext;
              if (t4 && typeof t4 === "object") {
                for (var n2 = 0; n2 < 2; n2++) {
                  var a2 = n2 ? "forceAdParameters" : "adParams";
                  if (Object.prototype.hasOwnProperty.call(t4, a2)) {
                    delete t4[a2];
                    r2.playbackAdParams++;
                  }
                }
                if (t4.isInlinePlaybackNoAd !== true) {
                  t4.isInlinePlaybackNoAd = true;
                  r2.inlineNoAd++;
                }
              }
            }
            if (t3 === "get_watch") {
              context(e3.context);
              player(e3.playerRequest);
            } else player(e3);
          }
          function utf8Size(e3) {
            var t3 = 0;
            for (var r2 = 0; r2 < e3.length; r2++) {
              var n2 = e3.charCodeAt(r2);
              if (n2 < 128) t3++;
              else if (n2 < 2048) t3 += 2;
              else if (n2 >= 55296 && n2 <= 56319 && r2 + 1 < e3.length && e3.charCodeAt(r2 + 1) >= 56320 && e3.charCodeAt(r2 + 1) <= 57343) {
                t3 += 4;
                r2++;
              } else t3 += 3;
            }
            return t3;
          }
          function checksum(e3) {
            var t3 = 2166136261;
            for (var r2 = 0; r2 < e3.length; r2++) {
              t3 ^= e3.charCodeAt(r2);
              t3 = Math.imul(t3, 16777619);
            }
            return "fnv1a32-utf16:" + ("00000000" + (t3 >>> 0).toString(16)).slice(-8);
          }
          function base64(e3) {
            var t3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", r2 = "";
            for (var n2 = 0; n2 < e3.length; n2 += 3) {
              var a2 = e3[n2], i2 = n2 + 1 < e3.length ? e3[n2 + 1] : 0, o4 = n2 + 2 < e3.length ? e3[n2 + 2] : 0;
              r2 += t3[a2 >> 2] + t3[(a2 & 3) << 4 | i2 >> 4] + (n2 + 1 < e3.length ? t3[(i2 & 15) << 2 | o4 >> 6] : "=") + (n2 + 2 < e3.length ? t3[o4 & 63] : "=");
            }
            return r2;
          }
          function captureBody(e3) {
            if (e3 === void 0 || e3 === null) return { available: false, reason: "not-provided-by-runtime" };
            if (typeof e3 === "string") return { available: true, encoding: "utf8-text", bytes: utf8Size(e3), data: e3 };
            var t3 = bytesOf(e3);
            return t3 ? { available: true, encoding: "base64", bytes: t3.length, data: base64(t3) } : { available: false, reason: "unsupported-runtime-body-type" };
          }
          function loggerConfig() {
            if (!flag(d.log_enabled) || typeof n === "undefined") return null;
            var e3 = n.read(u2), t3 = e3 && e3.length <= 2048 ? JSON.parse(e3) : null;
            return t3 && t3.enabled === true && typeof t3.session === "string" && /^[a-z0-9-]{1,80}$/.test(t3.session) ? t3 : null;
          }
          function append(e3, t3) {
            var r2 = [];
            try {
              var a2 = loggerConfig();
              if (!a2) return false;
              if (!ytDiagnosticShouldRecord(e3, t3, d.log_level)) return true;
              ytDiagnosticPurgeLegacy();
              var i2 = n.read(l);
              if (i2 && utf8Size(i2) > 131072) return false;
              var o4 = i2 ? JSON.parse(i2) : null;
              var s4 = o4 && o4.session === a2.session && Array.isArray(o4.entries) ? o4 : { session: a2.session, entries: [], captureBytes: 0 };
              if (s4.entries.length >= 600) return false;
              var u3 = t3 ? JSON.stringify(ytDiagnosticSanitize(t3)) : null;
              var f2 = u3 ? utf8Size(u3) : 0;
              var c2 = [16, 32, 64].indexOf(Number(d.capture_budget)) >= 0 ? Number(d.capture_budget) * 1048576 : 33554432;
              if (f2 > 33554432 || (s4.captureBytes || 0) + f2 > c2) return false;
              if (u3) {
                var p2 = [];
                for (var g2 = 0; g2 < u3.length; ) {
                  var y2 = Math.min(g2 + 131072, u3.length);
                  if (y2 < u3.length && u3.charCodeAt(y2 - 1) >= 55296 && u3.charCodeAt(y2 - 1) <= 56319 && u3.charCodeAt(y2) >= 56320 && u3.charCodeAt(y2) <= 57343) y2--;
                  p2.push(u3.slice(g2, y2));
                  g2 = y2;
                }
                if (p2.length > 256) return false;
                var v2 = "ytads.capture." + a2.session + "." + t3.id + ".";
                e3.captureRef = { prefix: v2, chunks: p2.length, chars: u3.length, storedBytes: f2, checksum: checksum(u3) };
                for (var h2 = 0; h2 < p2.length; h2++) {
                  var m2 = v2 + h2;
                  if (n.write(p2[h2], m2) !== true) throw new Error("capture-write-failed");
                  r2.push(m2);
                }
              }
              var b2 = { session: a2.session, entries: s4.entries.concat([e3]), captureBytes: (s4.captureBytes || 0) + f2 };
              var w2 = JSON.stringify(b2);
              if (utf8Size(w2) > 131072 || ytDiagnosticCommitEntry(b2, c2) !== true) throw new Error("index-write-failed");
              return true;
            } catch (e4) {
              for (var x2 = 0; x2 < r2.length; x2++) try {
                n.write(void 0, r2[x2]);
              } catch (e5) {
              }
              return false;
            }
          }
          function save(e3, t3, r2) {
            try {
              if (flag(d.capture_raw) || !flag(d.log_enabled) || typeof n === "undefined") return;
              var a2 = { debug: 0, info: 1, warn: 2, error: 3 };
              var i2 = Object.prototype.hasOwnProperty.call(a2, d.log_level) ? d.log_level : "info";
              if (!Object.prototype.hasOwnProperty.call(a2, t3) || i2 !== "info" && a2[t3] < a2[i2]) return;
              append({ source: s3, version: o3, endpoint: r2, level: t3, time: (/* @__PURE__ */ new Date()).toISOString(), phase: "request", message: e3 }, null);
            } catch (e4) {
            }
          }
          function captureDevelopment(t3, r2, n2) {
            if (!flag(d.capture_raw) || typeof e2 === "undefined") return;
            try {
              var a2 = (/* @__PURE__ */ new Date()).toISOString();
              var u3 = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
              var l2 = { url: e2.url, method: e2.method || "GET", headers: e2.headers || {}, h2_trailers: e2.h2_trailers || {}, body: captureBody(e2.body) };
              var f2 = n2 && Object.prototype.hasOwnProperty.call(n2, "body");
              var c2 = { schema: 1, id: u3, time: a2, source: s3, version: o3, phase: "request", endpoint: r2, runtime: typeof $loon === "string" ? $loon : null, correlation: { urlMethodHash: checksum(l2.method + " " + l2.url), exactPairing: true }, request: l2, processing: { exception: null, executionScript: s3, elapsedMs: Date.now() - i, messages: [t3], arguments: { suppress_player_ads: p, log_level: d.log_level || "info" } }, requestAfter: { changed: !!f2, headerOverrides: f2 ? n2.headers || null : null, transportHeadersRecomputedByLoon: true, body: f2 ? captureBody(n2.body) : { reference: "request.body" } } };
              append({ source: s3, version: o3, endpoint: r2, level: "debug", time: a2, phase: "request", message: "development capture: changed=" + !!f2 }, c2);
            } catch (e3) {
            }
          }
          function log(e3, t3, r2) {
            save(e3, t3, r2);
            if (g && typeof console !== "undefined") console.log("[" + s3 + " " + o3 + "] " + r2 + " " + e3);
          }
          function outputHeaders(e3) {
            var t3 = {}, r2 = e3 || {};
            Object.keys(r2).forEach(function(e4) {
              var n2 = e4.toLowerCase();
              if (n2 !== "content-encoding" && n2 !== "content-length") t3[e4] = r2[e4];
            });
            return t3;
          }
          var y = {};
          var v = typeof e2 !== "undefined" ? endpoint(e2.url) : null;
          if (p && v && typeof t2 === "undefined" && e2.body !== void 0 && e2.body !== null) {
            try {
              var h = { contextAdSignals: 0, playbackAdParams: 0, inlineNoAd: 0 };
              var m = String(e2.headers && (e2.headers["Content-Type"] || e2.headers["content-type"]) || "").toLowerCase();
              if (typeof e2.body === "string" && (m.indexOf("json") >= 0 || /^\s*[\[{]/.test(e2.body))) {
                var b = JSON.parse(e2.body), w = JSON.stringify(b);
                cleanJson(b, v, h);
                var x = JSON.stringify(b);
                if (x !== w) y = { headers: outputHeaders(e2.headers), body: x };
              } else {
                var S = bytesOf(e2.body);
                if (!S || !S.length || S.length > f) fail("unsupported-body");
                var k = v === "get_watch" ? cleanGetWatch(S, { fields: 0 }, h) : cleanPlayer(S, { fields: 0 }, h);
                if (k.changed) y = { headers: outputHeaders(e2.headers), body: k.body };
              }
              var A = Object.prototype.hasOwnProperty.call(y, "body");
              var _ = (A ? "changed" : "pass") + ": context_ad_signals=" + h.contextAdSignals + " playback_ad_params=" + h.playbackAdParams + " inline_no_ad=" + h.inlineNoAd + " region_selected=" + (selectedRegion() || "original") + " region_applied=" + (h.regionApplied || 0);
              log(_, A ? "info" : "debug", v);
              captureDevelopment(_, v, y);
            } catch (e3) {
              log("pass: " + (e3 && e3.message || "parse-failed"), "warn", v);
              y = {};
            }
          }
          a(y);
        })();
      } else {
        a({});
      }
    })();
  }, e);
}
export {
  YouTubePlayback
};
