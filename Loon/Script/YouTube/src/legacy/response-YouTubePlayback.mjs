// devchristian1337; extracted from the previously vendored bundle. See SOURCE.md.
import { ytRuntimeInvoke } from "../legacy-runtime.mjs";
function YouTubePlayback(e, r) {
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
    function ytDiagnosticQuality(e3, r3) {
      var t2 = { schema: 1, purpose: "quality-research", actualRenderedQuality: "not-observed" };
      function number(e4, r4) {
        return typeof e4 === "number" && Number.isSafeInteger(e4) && e4 >= 0 && e4 <= r4 ? e4 : null;
      }
      function bytes(e4, t3) {
        if (!e4 || e4.available !== true || !Number.isSafeInteger(e4.bytes) || e4.bytes > t3) return null;
        return e4.memoryBytes instanceof Uint8Array ? e4.memoryBytes : e4.encoding === "base64" ? r3(e4.data) : null;
      }
      function fields(e4) {
        var r4 = 0, t3 = [];
        function integer() {
          var t4 = 0, n4 = 1;
          for (var a4 = 0; a4 < 10 && r4 < e4.length; a4++) {
            var i4 = e4[r4++];
            if (a4 === 9 && i4 > 1) throw Error("varint");
            t4 += (i4 & 127) * n4;
            if (i4 < 128) return Number.isSafeInteger(t4) ? t4 : null;
            n4 *= 128;
          }
          throw Error("varint");
        }
        while (r4 < e4.length) {
          if (t3.length >= 512) throw Error("fields-limit");
          var n3 = integer();
          if (!n3 || n3 > 4294967295) throw Error("tag");
          var a3 = Math.floor(n3 / 8), i3 = n3 % 8, o3 = { field: a3, wire: i3 };
          if (i3 === 0) o3.value = integer();
          else if (i3 === 1 || i3 === 5) r4 += i3 === 1 ? 8 : 4;
          else if (i3 === 2) {
            var s3 = integer();
            if (s3 === null || s3 > e4.length - r4) throw Error("length");
            o3.bytes = e4.subarray(r4, r4 + s3);
            r4 += s3;
          } else throw Error("wire");
          if (r4 > e4.length) throw Error("truncated");
          t3.push(o3);
        }
        return t3;
      }
      function abr(e4) {
        var r4 = fields(e4), t3 = { status: "schema-candidate", schema: "LuanRT/googlevideo VideoPlaybackAbrRequest", iosSchemaVerified: false }, n3 = {}, a3 = { initialization: [], audio: [], video: [] }, i3 = false;
        var o3 = { 13: ["timeSinceLastManualSelectionMs", 864e5], 16: ["lastManualSelectedResolution", 8640], 18: ["viewportWidth", 32768], 19: ["viewportHeight", 32768], 20: ["bitrateCapBytesPerSecond", 1e9], 21: ["stickyResolution", 8640], 23: ["bandwidthEstimate", 1e12], 26: ["videoQualitySetting", 3], 30: ["dataSaverMode", 1], 62: ["supportsQualityConstraints", 1] };
        for (var s3 = 0; s3 < r4.length; s3++) {
          var u3 = r4[s3];
          if (u3.field === 1 && u3.wire === 2) {
            var l2 = fields(u3.bytes);
            for (var f = 0; f < l2.length; f++) {
              var d = l2[f], c = o3[d.field], p = c && d.wire === 0 ? number(d.value, c[1]) : null;
              if (p !== null) {
                n3[c[0]] = p;
                i3 = true;
              }
            }
          }
          var v = u3.field === 2 ? "initialization" : u3.field === 16 ? "audio" : u3.field === 17 ? "video" : null;
          if (v && u3.wire === 2 && a3[v].length < 64) {
            var g = fields(u3.bytes);
            for (var h = 0; h < g.length; h++) if (g[h].field === 1 && g[h].wire === 0) {
              var y = number(g[h].value, 65535);
              if (y !== null && y > 0 && a3[v].indexOf(y) < 0) a3[v].push(y);
            }
          }
          if ((u3.field === 22 || u3.field === 23) && u3.wire === 0) {
            var m = number(u3.value, 65535);
            if (m !== null) t3[u3.field === 22 ? "lastVideoItag" : "lastAudioItag"] = m;
          }
        }
        if (!i3) return { status: "unrecognized-schema" };
        t3.clientAbrState = n3;
        t3.formatItags = a3;
        return t3;
      }
      function formats(e4) {
        var r4 = e4 && e4.streamingData || e4 && e4.playerResponse && e4.playerResponse.streamingData;
        if (!r4) return { status: "no-json-streaming-data" };
        var t3 = { status: "observed-json-formats", formats: [] }, n3 = { itag: 65535, width: 32768, height: 32768, fps: 240, bitrate: 1e9, averageBitrate: 1e9, audioSampleRate: 384e3, audioChannels: 32 };
        var a3 = [r4.formats, r4.adaptiveFormats];
        for (var i3 = 0; i3 < a3.length; i3++) {
          var o3 = a3[i3];
          if (!Array.isArray(o3)) continue;
          for (var s3 = 0; s3 < o3.length && t3.formats.length < 128; s3++) {
            var u3 = o3[s3];
            if (!u3 || typeof u3 !== "object") continue;
            var l2 = { source: i3 === 0 ? "formats" : "adaptiveFormats" };
            for (var f in n3) {
              var d = number(u3[f], n3[f]);
              if (d !== null) l2[f] = d;
            }
            if (typeof u3.qualityLabel === "string" && /^(?:144|240|360|480|720|1080|1440|2160|2880|4320|8640)p(?:48|50|60|90|120)?$/.test(u3.qualityLabel)) l2.qualityLabel = u3.qualityLabel;
            if (typeof u3.mimeType === "string") {
              var c = /^(video|audio)\/(mp4|webm)(?:\s*;|$)/.exec(u3.mimeType);
              if (c) l2.container = c[1] + "/" + c[2];
            }
            l2.hasDirectUrl = typeof u3.url === "string" && /^https:\/\//.test(u3.url);
            l2.hasCipher = typeof u3.signatureCipher === "string" || typeof u3.cipher === "string";
            if (Object.keys(l2).length > 3) t3.formats.push(l2);
          }
        }
        return t3;
      }
      try {
        var n2 = e3.request || {}, a2 = String(n2.url || "");
        if (e3.endpoint === "ump") {
          var i2 = /[?&]itag=(\d{1,5})(?:&|$)/.exec(a2);
          if (i2 && Number(i2[1]) > 0 && Number(i2[1]) <= 65535) t2.urlItag = Number(i2[1]);
          if (e3.phase === "request" && String(n2.method || "GET").toUpperCase() === "POST") {
            var o2 = bytes(n2.body, 262144);
            t2.abr = o2 ? abr(o2) : { status: "request-body-unavailable-or-too-large" };
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
          t2.player = u2 ? formats(JSON.parse(u2)) : { status: "binary-player-schema-unverified-or-body-unavailable" };
        }
      } catch (e4) {
        t2.analysisStatus = "unsupported-or-malformed-body";
      }
      return t2;
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
        Object.keys(e4 || {}).forEach(function(t2) {
          var n3 = String(e4[t2]);
          if (/^(content-type|content-length|content-encoding|accept-encoding)$/i.test(t2) && /^[a-z0-9\s/.,;+_=\-]{0,160}$/i.test(n3) || /^transfer-encoding$/i.test(t2) && /^(?:chunked|gzip|deflate|br|identity)(?:,\s*(?:chunked|gzip|deflate|br|identity))*$/i.test(n3) || /^accept-ranges$/i.test(t2) && /^(?:bytes|none)$/i.test(n3) || /^content-range$/i.test(t2) && /^bytes (?:\d+-\d+|\*)\/(?:\d+|\*)$/.test(n3)) r4[t2] = n3;
        });
        return r4;
      }
      function decode(e4) {
        var r4 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", t2 = [], n3 = 0, a2 = 0;
        for (var i2 = 0; i2 < e4.length && e4[i2] !== "="; i2++) {
          var o2 = r4.indexOf(e4[i2]);
          if (o2 < 0) throw Error("base64");
          n3 = n3 << 6 | o2;
          a2 += 6;
          if (a2 >= 8) {
            a2 -= 8;
            t2.push(n3 >>> a2 & 255);
          }
        }
        return new Uint8Array(t2);
      }
      var n2 = 0;
      function proto(e4, r4) {
        if (r4 > 32 || n2 > 3e4) return { bytes: e4.length, omitted: true };
        var t2 = 0, a2 = [];
        function integer() {
          var r5 = 0, n3 = 1;
          for (var a3 = 0; a3 < 10 && t2 < e4.length; a3++) {
            var i3 = e4[t2++];
            r5 += (i3 & 127) * n3;
            if (i3 < 128) return r5;
            n3 *= 128;
          }
          throw Error("varint");
        }
        while (t2 < e4.length) {
          if (++n2 > 3e4) throw Error("limit");
          var i2 = integer(), o2 = Math.floor(i2 / 8), s2 = i2 % 8;
          if (!o2) throw Error("tag");
          var u2 = { field: o2, wire: s2 };
          if (s2 === 0) {
            var l = integer();
            u2.value = l === 0 || l === 1 ? l : "[removed]";
          } else if (s2 === 1 || s2 === 5) {
            var f = s2 === 1 ? 8 : 4;
            t2 += f;
            u2.bytes = f;
          } else if (s2 === 2) {
            var d = integer();
            if (!Number.isSafeInteger(d) || d < 0 || d > e4.length - t2) throw Error("length");
            var c = e4.subarray(t2, t2 + d);
            t2 += d;
            u2.bytes = d;
            try {
              u2.fields = proto(c, r4 + 1);
            } catch (e5) {
              var p = "";
              for (var v = 0; v < c.length; v++) p += c[v] >= 32 && c[v] < 127 ? String.fromCharCode(c[v]) : " ";
              u2.markers = labels(p);
            }
          } else throw Error("wire");
          if (t2 > e4.length) throw Error("truncated");
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
          var t2 = {};
          Object.keys(e4).forEach(function(n3) {
            if (!/token|cookie|auth|visitor|account|signature|clientkey|encryptkey|trackingparams|clicktracking/i.test(n3) && /^[a-zA-Z_][a-zA-Z0-9_]{0,80}$/.test(n3)) t2[n3] = json(e4[n3], r4 + 1);
          });
          return t2;
        }
        return e4;
      }
      function body(r4, t2, n3) {
        if (!r4 || r4.reference || !r4.available) return r4;
        var a2 = { available: false, reason: "privacy-structure-only", bytes: r4.bytes, redacted: true };
        if (!n3 && /^(config|log_event|initplayback|ump)$/.test(e3.endpoint)) return a2;
        try {
          var i2 = r4.encoding === "base64" ? decode(r4.data) : null;
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
      if (!e3.privacy && typeof $loon === "string" && typeof t === "object" && t && (t.log_enabled === true || t.log_enabled === "true") && (t.quality_research === true || t.quality_research === "true") && /^(ump|player|get_watch)$/.test(e3.endpoint)) {
        e3.qualityResearch = ytDiagnosticQuality(e3, decode);
      }
      ["request", "requestAfter", "requestInner", "requestInnerAfter", "responseBefore", "responseAfter"].forEach(function(r4) {
        var t2 = e3[r4];
        if (!t2) return;
        var n3 = {};
        ["status", "method", "synthetic", "changed", "transportHeadersRecomputedByLoon"].forEach(function(e4) {
          if (t2[e4] !== void 0) n3[e4] = t2[e4];
        });
        if (t2.url) n3.url = url(t2.url);
        if (t2.headers) n3.headers = headers(t2.headers);
        if (t2.headerOverrides) n3.headerOverrides = headers(t2.headerOverrides);
        n3.body = body(t2.body, r4 === "request" || r4 === "requestAfter", r4 === "requestInner" || r4 === "requestInnerAfter");
        e3[r4] = n3;
      });
      if (e3.processing && e3.processing.exception) e3.processing.exception = { code: "processing-failed" };
      e3.privacy = "structure-only-v1";
      return e3;
    }
    (function() {
      "use strict";
      var i2 = typeof e2 !== "undefined" ? String(e2.url || "") : "";
      var o2 = typeof r2 !== "undefined";
      if (o2 && /\/youtubei\/v1\/(?:player|get_watch)(?:\?[^#]*)?$/i.test(i2)) {
        (function() {
          "use strict";
          var i3 = "2.3.0";
          var o3 = 3e4;
          var s2 = typeof t === "object" && t ? t : {};
          s2.log_level = String(s2.log_level || "info").toLowerCase();
          if (typeof s2.capture_raw === "undefined") s2.capture_raw = s2.log_enabled;
          var u2 = s2.script_debug === true || s2.script_debug === "true";
          var l = s2.background_playback === true || s2.background_playback === "true";
          var f = "unknown";
          var d = 2 * 1024 * 1024;
          var c = 2e4;
          var p = /^https:\/\/(?:youtubei(?:-att)?\.googleapis\.com|(?:www\.|m\.|music\.)?youtube\.com)\/youtubei\/v1\/(player|get_watch)(?:\?[^#]*)?$/i;
          var v = [];
          var g = null;
          function devFailure(e3) {
            if (!devFlag(s2.capture_raw)) return;
            try {
              g = { name: String(e3.name || "Error"), message: String(e3.message || ""), stack: typeof e3.stack === "string" ? e3.stack : null, code: e3.ytNoAdsCode || null };
            } catch (e4) {
            }
          }
          var h = Date.now();
          function devFlag(e3) {
            return e3 === true || e3 === "true";
          }
          function devConfig() {
            if (!devFlag(s2.log_enabled) || typeof n === "undefined") return null;
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
          function devBase64(e3) {
            var r3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var t2 = [], n2 = "";
            for (var a2 = 0; a2 < e3.length; a2 += 3) {
              var i4 = e3[a2], o4 = a2 + 1 < e3.length ? e3[a2 + 1] : 0, s3 = a2 + 2 < e3.length ? e3[a2 + 2] : 0;
              n2 += r3[i4 >> 2] + r3[(i4 & 3) << 4 | o4 >> 4] + (a2 + 1 < e3.length ? r3[(o4 & 15) << 2 | s3 >> 6] : "=") + (a2 + 2 < e3.length ? r3[s3 & 63] : "=");
              if (n2.length >= 32768) {
                t2.push(n2);
                n2 = "";
              }
            }
            t2.push(n2);
            return t2.join("");
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
            return { available: true, encoding: "base64", bytes: t2.length, data: devBase64(t2) };
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
            var t2 = [], a2 = null;
            try {
              a2 = devConfig();
              if (!a2) return false;
              if (!ytDiagnosticShouldRecord(e3, r3, s2.log_level)) return true;
              ytDiagnosticPurgeLegacy();
              var i4 = n.read("ytads.logger.entries.v2");
              if (i4 && devUTF8Size(i4) > 131072) throw new Error("log-index-invalid");
              var o4 = i4 ? JSON.parse(i4) : null;
              var u3 = o4 && o4.session === a2.session && Array.isArray(o4.entries) ? o4 : { session: a2.session, entries: [], captureBytes: 0 };
              if (u3.entries.length >= 600) {
                devHalt(a2, "entry-limit");
                return false;
              }
              var l2 = r3 ? JSON.stringify(ytDiagnosticSanitize(r3)) : null;
              if (l2 && l2.length > 33554432) {
                devHalt(a2, "capture-event-limit");
                return false;
              }
              var f2 = u3.captureBytes || 0;
              var d2 = [16, 32, 64].indexOf(Number(s2.capture_budget)) >= 0 ? Number(s2.capture_budget) * 1048576 : 33554432;
              var c2 = l2 ? devUTF8Size(l2) : 0;
              if (f2 + c2 > d2) {
                devHalt(a2, "capture-budget-limit");
                return false;
              }
              var p2 = [];
              if (l2) {
                for (var v2 = 0; v2 < l2.length; ) {
                  var g2 = Math.min(v2 + 131072, l2.length);
                  if (g2 < l2.length && l2.charCodeAt(g2 - 1) >= 55296 && l2.charCodeAt(g2 - 1) <= 56319 && l2.charCodeAt(g2) >= 56320 && l2.charCodeAt(g2) <= 57343) g2--;
                  p2.push(l2.slice(v2, g2));
                  v2 = g2;
                }
                if (p2.length > 256) {
                  devHalt(a2, "capture-event-limit");
                  return false;
                }
                var h2 = "ytads.capture." + a2.session + "." + r3.id + ".";
                e3.captureRef = { prefix: h2, chunks: p2.length, chars: l2.length, storedBytes: c2, checksum: devChecksum(l2) };
              }
              var y2 = { session: a2.session, entries: u3.entries.concat([e3]), captureBytes: f2 + c2 };
              var m = JSON.stringify(y2);
              if (devUTF8Size(m) > 131072) {
                devHalt(a2, "log-index-limit");
                return false;
              }
              if (l2) {
                for (var b = 0; b < e3.captureRef.chunks; b++) {
                  var w = e3.captureRef.prefix + b;
                  if (n.write(p2[b], w) !== true) throw new Error("capture-write-failed");
                  t2.push(w);
                }
              }
              if (ytDiagnosticCommitEntry(y2, d2) !== true) throw new Error("log-index-write-failed");
              return true;
            } catch (e4) {
              t2.forEach(function(e5) {
                try {
                  n.write(void 0, e5);
                } catch (e6) {
                }
              });
              try {
                devHalt(a2, "storage-or-serialization-failed");
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
            if (!devFlag(s2.capture_raw)) return;
            var u3 = null;
            try {
              u3 = devConfig();
              if (!u3 || typeof e2 === "undefined") return;
              var f2 = (/* @__PURE__ */ new Date()).toISOString();
              var d2 = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
              var c2 = { url: e2.url, method: e2.method || "GET", headers: e2.headers || {}, h2_trailers: e2.h2_trailers || {}, body: devBody(e2.body) };
              var p2 = { schema: 1, id: d2, time: f2, source: t2, version: i4, phase: n2, endpoint: a2, runtime: typeof $loon === "string" ? $loon : null, correlation: { urlMethodHash: devCorrelation(c2.method, c2.url), exactPairing: false }, request: c2, processing: { exception: g, executionScript: n2 === "request" ? "YouTubeLogger" : t2, elapsedMs: Date.now() - h, messages: v.slice(), arguments: { background_playback: l, log_level: s2.log_level || "info" } } };
              if (n2 === "response" && typeof r2 !== "undefined") {
                p2.responseBefore = { status: r2.status, headers: r2.headers || {}, h2_trailers: r2.h2_trailers || {}, body: devBody(r2.body) };
                var y2 = o4 && Object.prototype.hasOwnProperty.call(o4, "body");
                p2.responseAfter = { changed: !!y2, status: o4 && o4.status !== void 0 ? o4.status : r2.status, headerOverrides: o4 && o4.headers || null, transportHeadersRecomputedByLoon: true, body: y2 ? devBody(o4.body) : { reference: "responseBefore.body" } };
              }
              devAppend({ source: t2, version: i4, endpoint: a2, level: "debug", time: f2, phase: n2, message: "development capture: " + n2 + (p2.responseAfter ? " changed=" + p2.responseAfter.changed : "") }, p2);
            } catch (e3) {
              try {
                devHalt(u3, e3.message === "capture-body-limit" ? "capture-body-limit" : "capture-serialization-failed");
              } catch (e4) {
              }
            }
          }
          function saveLog(e3) {
            v.push(e3);
            if (devFlag(s2.capture_raw)) return;
            var r3 = { debug: 0, info: 1, warn: 2, error: 3 };
            var t2 = e3.indexOf("changed:") === 0 ? "info" : e3 === "pass: parse/schema check failed" ? "error" : /^(pass: (removed=|mode=|non-UMP))/.test(e3) ? "debug" : "warn";
            var n2 = Object.prototype.hasOwnProperty.call(r3, s2.log_level) ? s2.log_level : "info";
            if (n2 === "info" || r3[t2] >= r3[n2]) devAppend({ source: "YouTubePlayback", level: t2, time: (/* @__PURE__ */ new Date()).toISOString(), version: i3, endpoint: f, message: e3 }, null);
          }
          function log(e3) {
            saveLog(e3);
            if (u2 && typeof console !== "undefined") {
              console.log("[YouTubePlayback " + i3 + "] " + f + " " + e3);
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
          function parse(e3, r3) {
            var t2 = { pos: 0 };
            var n2 = [];
            while (t2.pos < e3.length) {
              if (++r3.fields > o3) fail("field-limit");
              var a2 = t2.pos;
              var i4 = read32(e3, t2);
              var s3 = Math.floor(i4 / 8);
              var u3 = i4 % 8;
              if (s3 < 1 || s3 > 536870911) fail("invalid-tag");
              var l2 = t2.pos;
              var f2 = t2.pos;
              if (u3 === 0) skip64(e3, t2);
              else if (u3 === 1) t2.pos += 8;
              else if (u3 === 2) {
                var d2 = read32(e3, t2);
                f2 = t2.pos;
                if (d2 > e3.length - t2.pos) fail("truncated-field");
                t2.pos += d2;
              } else if (u3 === 5) t2.pos += 4;
              else fail("unsupported-wire-type");
              if (t2.pos > e3.length) fail("truncated-field");
              n2.push({ no: s3, wire: u3, start: a2, tagEnd: l2, payloadStart: f2, end: t2.pos });
            }
            return n2;
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
          function encodeField(e3, r3, t2) {
            return join([encodeLength(e3 * 8 + r3), r3 === 2 ? encodeLength(t2.length) : new Uint8Array(0), t2]);
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
          function varintIsTrue(e3, r3) {
            for (var t2 = r3.tagEnd; t2 < r3.end; t2++) {
              if ((e3[t2] & 127) !== 0) return true;
            }
            return false;
          }
          function enableNestedBoolean(e3, r3) {
            var t2 = parse(e3, { fields: 0 });
            var n2 = encodeField(r3, 2, new Uint8Array([8, 1]));
            var a2 = [], i4 = false, o4 = false;
            for (var s3 = 0; s3 < t2.length; s3++) {
              var u3 = t2[s3];
              if (u3.no !== r3) {
                a2.push(e3.subarray(u3.start, u3.end));
                continue;
              }
              if (u3.wire !== 2) fail("background-schema-mismatch");
              i4 = true;
              var l2 = e3.subarray(u3.payloadStart, u3.end);
              var f2 = parse(l2, { fields: 0 });
              var d2 = [], c2 = false;
              for (var p2 = 0; p2 < f2.length; p2++) {
                var v2 = f2[p2];
                if (v2.no === 1) {
                  if (v2.wire !== 0) fail("background-schema-mismatch");
                  if (varintIsTrue(l2, v2)) c2 = true;
                  continue;
                }
                d2.push(l2.subarray(v2.start, v2.end));
              }
              d2.push(new Uint8Array([8, 1]));
              var g2 = join(d2);
              a2.push(encodeField(r3, 2, g2));
              if (!c2 || f2.filter(function(e4) {
                return e4.no === 1;
              }).length !== 1) o4 = true;
            }
            if (!i4) {
              a2.push(n2);
              o4 = true;
            }
            return { body: o4 ? join(a2) : e3, changed: o4 };
          }
          function enableBackground(e3, r3) {
            var t2 = [];
            for (var n2 = 0; n2 < r3.length; n2++) {
              if (r3[n2].no !== 4) continue;
              if (r3[n2].wire !== 0) fail("background-schema-mismatch");
              t2.push(n2);
            }
            var a2 = new Uint8Array([32, 1]);
            var i4 = !(t2.length === 1 && varintIsTrue(e3, r3[t2[0]]));
            var o4 = [];
            for (var s3 = 0; s3 < r3.length; s3++) {
              if (r3[s3].no === 4) {
                if (s3 === t2[0]) o4.push(a2);
              } else {
                o4.push(e3.subarray(r3[s3].start, r3[s3].end));
              }
            }
            if (!t2.length) o4.push(a2);
            var u3 = i4 ? join(o4) : e3;
            var l2 = parse(u3, { fields: 0 });
            var f2 = false, d2 = false, c2 = [];
            for (var p2 = 0; p2 < l2.length; p2++) {
              var v2 = l2[p2];
              if (v2.no !== 11) {
                c2.push(u3.subarray(v2.start, v2.end));
                continue;
              }
              if (v2.wire !== 2) fail("background-schema-mismatch");
              f2 = true;
              var g2 = enableNestedBoolean(u3.subarray(v2.payloadStart, v2.end), 64657230);
              d2 = d2 || g2.changed;
              c2.push(g2.changed ? encodeField(11, 2, g2.body) : u3.subarray(v2.start, v2.end));
            }
            if (!f2) {
              c2.push(encodeField(11, 2, encodeField(64657230, 2, new Uint8Array([8, 1]))));
              d2 = true;
            }
            return { body: i4 || d2 ? join(c2) : e3, background: i4 || d2 ? 1 : 0 };
          }
          function cleanTracking(e3, r3) {
            var t2 = parse(e3, r3), n2 = [], a2 = 0;
            for (var i4 = 0; i4 < t2.length; i4++) {
              var o4 = t2[i4];
              if (o4.no === 18) {
                if (o4.wire !== 2) fail("tracking-schema-mismatch");
                a2++;
              } else n2.push(e3.subarray(o4.start, o4.end));
            }
            return { body: a2 ? join(n2) : e3, removed: a2 };
          }
          function cleanPlayer(e3, r3) {
            var t2 = parse(e3, r3);
            var n2 = [];
            for (var a2 = 0; a2 < t2.length && n2.length < 24; a2++) n2.push(t2[a2].no + "/" + t2[a2].wire);
            var i4 = n2.join(",") + (t2.length > 24 ? ",more" : "");
            var o4 = false;
            var s3 = [], u3 = [];
            for (var f2 = 0; f2 < t2.length; f2++) {
              var d2 = t2[f2];
              if (d2.no === 2) {
                if (d2.wire !== 2) fail("player-schema-mismatch");
                var c2 = parse(e3.subarray(d2.payloadStart, d2.end), r3);
                for (var p2 = 0; p2 < c2.length; p2++) {
                  if (c2[p2].no === 1 && c2[p2].wire !== 0) fail("status-schema-mismatch");
                }
                if (l) s3[f2] = enableBackground(e3.subarray(d2.payloadStart, d2.end), c2);
                o4 = true;
              }
              if ((d2.no === 7 || d2.no === 68) && d2.wire !== 2) fail("ad-schema-mismatch");
              if (d2.no === 9) {
                if (d2.wire !== 2) fail("tracking-schema-mismatch");
                u3[f2] = cleanTracking(e3.subarray(d2.payloadStart, d2.end), r3);
              }
            }
            if (!o4) return { body: e3, removed: 0, tracking: 0, background: 0, fieldSummary: i4 };
            var v2 = [];
            var g2 = 0;
            var h2 = 0;
            var y2 = 0;
            for (var m = 0; m < t2.length; m++) {
              var b = t2[m];
              if (b.no === 7 || b.no === 68) g2++;
              else if (u3[m] && u3[m].removed) {
                v2.push(replaceChild(e3, b, u3[m].body));
                g2 += u3[m].removed;
                h2 += u3[m].removed;
              } else if (s3[m] && s3[m].background) {
                v2.push(replaceChild(e3, b, s3[m].body));
                y2 += s3[m].background;
              } else v2.push(e3.subarray(b.start, b.end));
            }
            return { body: g2 || y2 ? join(v2) : e3, removed: g2, tracking: h2, background: y2, fieldSummary: i4 };
          }
          function cleanWatch(e3, r3, t2) {
            var n2 = parse(e3, r3);
            var a2 = t2 === 0 ? 1 : 2;
            var i4 = [];
            var o4 = 0;
            var s3 = 0;
            var u3 = 0;
            for (var l2 = 0; l2 < n2.length; l2++) {
              var f2 = n2[l2];
              if (f2.no !== a2) {
                i4.push(e3.subarray(f2.start, f2.end));
                continue;
              }
              if (f2.wire !== 2) fail("watch-schema-mismatch");
              var d2 = e3.subarray(f2.payloadStart, f2.end);
              var c2 = t2 === 0 ? cleanWatch(d2, r3, 1) : cleanPlayer(d2, r3);
              o4 += c2.removed;
              s3 += c2.tracking || 0;
              u3 += c2.background;
              i4.push(c2.removed || c2.background ? replaceChild(e3, f2, c2.body) : e3.subarray(f2.start, f2.end));
            }
            return { body: o4 || u3 ? join(i4) : e3, removed: o4, tracking: s3, background: u3 };
          }
          function cleanJSON(e3) {
            var r3 = JSON.parse(e3);
            if (!r3 || typeof r3 !== "object") return { body: e3, removed: 0, tracking: 0, background: 0 };
            var t2 = [{ value: r3, depth: 0, player: f === "player", backgroundTarget: f === "player" }];
            var n2 = 0;
            var a2 = 0;
            var i4 = 0;
            var o4 = 0;
            function enqueue(e4, r4, a3, i5) {
              if (n2 + t2.length >= c || r4 > 64) fail("json-limit");
              t2.push({ value: e4, depth: r4, player: a3, backgroundTarget: i5 });
            }
            while (t2.length) {
              var s3 = t2.pop();
              var u3 = s3.value;
              if (++n2 > c || s3.depth > 64) fail("json-limit");
              if (Array.isArray(u3)) {
                for (var d2 = 0; d2 < u3.length; d2++) {
                  if (u3[d2] && typeof u3[d2] === "object") {
                    enqueue(u3[d2], s3.depth + 1, s3.player, s3.backgroundTarget);
                  }
                }
                continue;
              }
              var p2 = s3.player || Object.prototype.hasOwnProperty.call(u3, "playabilityStatus") || Object.prototype.hasOwnProperty.call(u3, "streamingData");
              if (p2) {
                var v2 = ["adPlacements", "adSlots", "playerAds", "adBreakHeartbeatParams", "adParams"];
                for (var g2 = 0; g2 < v2.length; g2++) {
                  if (Object.prototype.hasOwnProperty.call(u3, v2[g2])) {
                    delete u3[v2[g2]];
                    a2++;
                  }
                }
                if (u3.playbackTracking && typeof u3.playbackTracking === "object" && Object.prototype.hasOwnProperty.call(u3.playbackTracking, "pageadViewthroughconversion")) {
                  delete u3.playbackTracking.pageadViewthroughconversion;
                  a2++;
                  i4++;
                }
                if (u3.playerConfig && typeof u3.playerConfig === "object" && !Array.isArray(u3.playerConfig)) {
                  var h2 = ["adPlacementConfig", "adSignalsConfig"];
                  for (var y2 = 0; y2 < h2.length; y2++) {
                    if (Object.prototype.hasOwnProperty.call(u3.playerConfig, h2[y2])) {
                      delete u3.playerConfig[h2[y2]];
                      a2++;
                    }
                  }
                }
              }
              if (l && s3.backgroundTarget && u3.playabilityStatus && typeof u3.playabilityStatus === "object" && !Array.isArray(u3.playabilityStatus)) {
                var m = false;
                if (u3.playabilityStatus.playableInBackground !== true) {
                  u3.playabilityStatus.playableInBackground = true;
                  m = true;
                }
                var b = u3.playabilityStatus.backgroundPlayerRender;
                if (!b || !b.backgroundAbility || b.backgroundAbility.active !== true) {
                  u3.playabilityStatus.backgroundPlayerRender = { backgroundAbility: { active: true } };
                  m = true;
                }
                if (m) o4++;
              }
              var w = Object.keys(u3);
              for (var S = 0; S < w.length; S++) {
                var k = w[S];
                var x = u3[k];
                if (x && typeof x === "object") {
                  var _ = k === "playerResponse" || k === "player";
                  enqueue(x, s3.depth + 1, _, _);
                }
              }
            }
            return { body: a2 || o4 ? JSON.stringify(r3) : e3, removed: a2, tracking: i4, background: o4 };
          }
          function run() {
            var t2 = p.exec(typeof e2 !== "undefined" ? e2.url || "" : "");
            if (!t2 || typeof r2 === "undefined") return {};
            f = t2[1].toLowerCase();
            var n2 = r2.status;
            if (n2 !== void 0 && Number(n2) !== 200) {
              log("pass: non-200");
              return {};
            }
            var a2 = header(r2.headers, "content-type").split(";")[0].trim();
            if (a2 === "application/vnd.yt-ump") {
              log("pass: UMP unsupported");
              return {};
            }
            var i4 = r2.body;
            var o4 = bytesOf(i4);
            if (typeof i4 !== "string" && !o4) {
              log("pass: body unavailable");
              return {};
            }
            if ((o4 ? o4.length : i4.length) > d) {
              log("pass: size-limit");
              return {};
            }
            if (!(o4 ? o4.length : i4.length)) {
              log("pass: empty");
              return {};
            }
            if (o4 && o4[0] === 31 && o4[1] === 139) {
              log("pass: compressed body");
              return {};
            }
            var s3 = /^(?:application\/(?:json|[\w.+-]+\+json)|text\/json)$/.test(a2);
            var u3;
            if (typeof i4 === "string" || s3) {
              var l2 = i4;
              if (o4) {
                if (typeof TextDecoder !== "function") {
                  log("pass: no UTF-8 decoder");
                  return {};
                }
                l2 = new TextDecoder("utf-8", { fatal: true }).decode(o4);
              }
              u3 = cleanJSON(l2);
              if ((u3.removed || u3.background) && o4) {
                if (typeof TextEncoder !== "function") {
                  log("pass: no UTF-8 encoder");
                  return {};
                }
                u3.body = new TextEncoder().encode(u3.body);
              }
            } else {
              if (a2 && !/^(?:application\/(?:x-protobuf|protobuf|vnd\.google\.protobuf|octet-stream))$/.test(a2)) {
                log("pass: unsupported content type");
                return {};
              }
              var c2 = { fields: 0 };
              u3 = f === "player" ? cleanPlayer(o4, c2) : cleanWatch(o4, c2, 0);
            }
            log((u3.removed || u3.background ? "changed" : "pass") + ": removed=" + u3.removed + " tracking_removed=" + (u3.tracking || 0) + " background_modified=" + u3.background + " format=" + (typeof i4 === "string" || s3 ? "json" : "protobuf") + (u3.fieldSummary ? " player_fields=" + u3.fieldSummary : ""));
            return u3.removed || u3.background ? { body: u3.body } : {};
          }
          var y = {};
          try {
            y = run();
          } catch (e3) {
            devFailure(e3);
            log("pass: " + (e3.ytNoAdsCode || "parse/schema check failed"));
          }
          if (typeof e2 !== "undefined" && typeof r2 !== "undefined" && p.test(e2.url || "")) devCapture("YouTubePlayback", "response", f, i3, y);
          a(y);
        })();
      } else if (o2 && /\/youtubei\/v1\/reel\/reel_watch_sequence(?:\?[^#]*)?$/i.test(i2)) {
        (function() {
          "use strict";
          var i3 = "1.0.0";
          var o3 = 3e4;
          var s2 = typeof t === "object" && t ? t : {};
          s2.log_level = String(s2.log_level || "info").toLowerCase();
          if (typeof s2.capture_raw === "undefined") s2.capture_raw = s2.log_enabled;
          var u2 = s2.script_debug === true || s2.script_debug === "true";
          var l = s2.remove_shorts_ads !== false && s2.remove_shorts_ads !== "false";
          var f = "unknown";
          var d = 2 * 1024 * 1024;
          var c = 2e4;
          var p = /^https:\/\/(?:youtubei(?:-att)?\.googleapis\.com|(?:www\.|m\.|music\.)?youtube\.com)\/youtubei\/v1\/reel\/reel_watch_sequence(?:\?[^#]*)?$/i;
          var v = [];
          var g = null;
          function devFailure(e3) {
            if (!devFlag(s2.capture_raw)) return;
            try {
              g = { name: String(e3.name || "Error"), message: String(e3.message || ""), stack: typeof e3.stack === "string" ? e3.stack : null, code: e3.ytNoAdsCode || null };
            } catch (e4) {
            }
          }
          var h = Date.now();
          function devFlag(e3) {
            return e3 === true || e3 === "true";
          }
          function devConfig() {
            if (!devFlag(s2.log_enabled) || typeof n === "undefined") return null;
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
          function devBase64(e3) {
            var r3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var t2 = [], n2 = "";
            for (var a2 = 0; a2 < e3.length; a2 += 3) {
              var i4 = e3[a2], o4 = a2 + 1 < e3.length ? e3[a2 + 1] : 0, s3 = a2 + 2 < e3.length ? e3[a2 + 2] : 0;
              n2 += r3[i4 >> 2] + r3[(i4 & 3) << 4 | o4 >> 4] + (a2 + 1 < e3.length ? r3[(o4 & 15) << 2 | s3 >> 6] : "=") + (a2 + 2 < e3.length ? r3[s3 & 63] : "=");
              if (n2.length >= 32768) {
                t2.push(n2);
                n2 = "";
              }
            }
            t2.push(n2);
            return t2.join("");
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
            return { available: true, encoding: "base64", bytes: t2.length, data: devBase64(t2) };
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
            var t2 = [], a2 = null;
            try {
              a2 = devConfig();
              if (!a2) return false;
              if (!ytDiagnosticShouldRecord(e3, r3, s2.log_level)) return true;
              ytDiagnosticPurgeLegacy();
              var i4 = n.read("ytads.logger.entries.v2");
              if (i4 && devUTF8Size(i4) > 131072) throw new Error("log-index-invalid");
              var o4 = i4 ? JSON.parse(i4) : null;
              var u3 = o4 && o4.session === a2.session && Array.isArray(o4.entries) ? o4 : { session: a2.session, entries: [], captureBytes: 0 };
              if (u3.entries.length >= 600) {
                devHalt(a2, "entry-limit");
                return false;
              }
              var l2 = r3 ? JSON.stringify(ytDiagnosticSanitize(r3)) : null;
              if (l2 && l2.length > 33554432) {
                devHalt(a2, "capture-event-limit");
                return false;
              }
              var f2 = u3.captureBytes || 0;
              var d2 = [16, 32, 64].indexOf(Number(s2.capture_budget)) >= 0 ? Number(s2.capture_budget) * 1048576 : 33554432;
              var c2 = l2 ? devUTF8Size(l2) : 0;
              if (f2 + c2 > d2) {
                devHalt(a2, "capture-budget-limit");
                return false;
              }
              var p2 = [];
              if (l2) {
                for (var v2 = 0; v2 < l2.length; ) {
                  var g2 = Math.min(v2 + 131072, l2.length);
                  if (g2 < l2.length && l2.charCodeAt(g2 - 1) >= 55296 && l2.charCodeAt(g2 - 1) <= 56319 && l2.charCodeAt(g2) >= 56320 && l2.charCodeAt(g2) <= 57343) g2--;
                  p2.push(l2.slice(v2, g2));
                  v2 = g2;
                }
                if (p2.length > 256) {
                  devHalt(a2, "capture-event-limit");
                  return false;
                }
                var h2 = "ytads.capture." + a2.session + "." + r3.id + ".";
                e3.captureRef = { prefix: h2, chunks: p2.length, chars: l2.length, storedBytes: c2, checksum: devChecksum(l2) };
              }
              var y2 = { session: a2.session, entries: u3.entries.concat([e3]), captureBytes: f2 + c2 };
              var m = JSON.stringify(y2);
              if (devUTF8Size(m) > 131072) {
                devHalt(a2, "log-index-limit");
                return false;
              }
              if (l2) {
                for (var b = 0; b < e3.captureRef.chunks; b++) {
                  var w = e3.captureRef.prefix + b;
                  if (n.write(p2[b], w) !== true) throw new Error("capture-write-failed");
                  t2.push(w);
                }
              }
              if (ytDiagnosticCommitEntry(y2, d2) !== true) throw new Error("log-index-write-failed");
              return true;
            } catch (e4) {
              t2.forEach(function(e5) {
                try {
                  n.write(void 0, e5);
                } catch (e6) {
                }
              });
              try {
                devHalt(a2, "storage-or-serialization-failed");
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
            if (!devFlag(s2.capture_raw)) return;
            var u3 = null;
            try {
              u3 = devConfig();
              if (!u3 || typeof e2 === "undefined") return;
              var f2 = (/* @__PURE__ */ new Date()).toISOString();
              var d2 = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
              var c2 = { url: e2.url, method: e2.method || "GET", headers: e2.headers || {}, h2_trailers: e2.h2_trailers || {}, body: devBody(e2.body) };
              var p2 = { schema: 1, id: d2, time: f2, source: t2, version: i4, phase: n2, endpoint: a2, runtime: typeof $loon === "string" ? $loon : null, correlation: { urlMethodHash: devCorrelation(c2.method, c2.url), exactPairing: false }, request: c2, processing: { exception: g, executionScript: n2 === "request" ? "YouTubeLogger" : t2, elapsedMs: Date.now() - h, messages: v.slice(), arguments: { remove_shorts_ads: l, log_level: s2.log_level || "info" } } };
              if (n2 === "response" && typeof r2 !== "undefined") {
                p2.responseBefore = { status: r2.status, headers: r2.headers || {}, h2_trailers: r2.h2_trailers || {}, body: devBody(r2.body) };
                var y2 = o4 && Object.prototype.hasOwnProperty.call(o4, "body");
                p2.responseAfter = { changed: !!y2, status: o4 && o4.status !== void 0 ? o4.status : r2.status, headerOverrides: o4 && o4.headers || null, transportHeadersRecomputedByLoon: true, body: y2 ? devBody(o4.body) : { reference: "responseBefore.body" } };
              }
              devAppend({ source: t2, version: i4, endpoint: a2, level: "debug", time: f2, phase: n2, message: "development capture: " + n2 + (p2.responseAfter ? " changed=" + p2.responseAfter.changed : "") }, p2);
            } catch (e3) {
              try {
                devHalt(u3, e3.message === "capture-body-limit" ? "capture-body-limit" : "capture-serialization-failed");
              } catch (e4) {
              }
            }
          }
          function saveLog(e3) {
            v.push(e3);
            if (devFlag(s2.capture_raw)) return;
            var r3 = { debug: 0, info: 1, warn: 2, error: 3 };
            var t2 = e3.indexOf("changed:") === 0 ? "info" : e3 === "pass: parse/schema check failed" ? "error" : /^(pass: (removed=|mode=|non-UMP))/.test(e3) ? "debug" : "warn";
            var n2 = Object.prototype.hasOwnProperty.call(r3, s2.log_level) ? s2.log_level : "info";
            if (n2 === "info" || r3[t2] >= r3[n2]) devAppend({ source: "YouTubePlayback", level: t2, time: (/* @__PURE__ */ new Date()).toISOString(), version: i3, endpoint: f, message: e3 }, null);
          }
          function log(e3) {
            saveLog(e3);
            if (u2 && typeof console !== "undefined") {
              console.log("[YouTubePlayback " + i3 + "] " + f + " " + e3);
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
          function parse(e3, r3) {
            var t2 = { pos: 0 };
            var n2 = [];
            while (t2.pos < e3.length) {
              if (++r3.fields > o3) fail("field-limit");
              var a2 = t2.pos;
              var i4 = read32(e3, t2);
              var s3 = Math.floor(i4 / 8);
              var u3 = i4 % 8;
              if (s3 < 1 || s3 > 536870911) fail("invalid-tag");
              var l2 = t2.pos;
              var f2 = t2.pos;
              if (u3 === 0) skip64(e3, t2);
              else if (u3 === 1) t2.pos += 8;
              else if (u3 === 2) {
                var d2 = read32(e3, t2);
                f2 = t2.pos;
                if (d2 > e3.length - t2.pos) fail("truncated-field");
                t2.pos += d2;
              } else if (u3 === 5) t2.pos += 4;
              else fail("unsupported-wire-type");
              if (t2.pos > e3.length) fail("truncated-field");
              n2.push({ no: s3, wire: u3, start: a2, tagEnd: l2, payloadStart: f2, end: t2.pos });
            }
            return n2;
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
          function encodeField(e3, r3, t2) {
            return join([encodeLength(e3 * 8 + r3), r3 === 2 ? encodeLength(t2.length) : new Uint8Array(0), t2]);
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
          function varintIsTrue(e3, r3) {
            for (var t2 = r3.tagEnd; t2 < r3.end; t2++) {
              if ((e3[t2] & 127) !== 0) return true;
            }
            return false;
          }
          function oneMessage(e3, r3, t2) {
            var n2 = parse(e3, t2), a2 = [];
            for (var i4 = 0; i4 < n2.length; i4++) if (n2[i4].no === r3) a2.push(n2[i4]);
            if (a2.length !== 1 || a2[0].wire !== 2) return null;
            return e3.subarray(a2[0].payloadStart, a2[0].end);
          }
          function protobufAdEntry(e3, r3) {
            var t2 = oneMessage(e3, 1, r3);
            if (!t2) return false;
            var n2 = oneMessage(t2, 139608561, r3);
            if (!n2) return false;
            var a2 = oneMessage(n2, 16, r3);
            if (!a2) return false;
            var i4 = parse(a2, r3), o4 = false;
            for (var s3 = 0; s3 < i4.length; s3++) {
              if (i4[s3].no !== 1) continue;
              if (i4[s3].wire !== 0) fail("shorts-ad-schema-mismatch");
              if (varintIsTrue(a2, i4[s3])) o4 = true;
            }
            return o4;
          }
          function cleanProto(e3, r3) {
            var t2 = parse(e3, r3), n2 = [], a2 = 0, i4 = 0;
            for (var o4 = 0; o4 < t2.length; o4++) {
              var s3 = t2[o4];
              if (s3.no !== 2) {
                n2.push(e3.subarray(s3.start, s3.end));
                continue;
              }
              i4++;
              if (s3.wire !== 2) fail("shorts-entry-schema-mismatch");
              if (protobufAdEntry(e3.subarray(s3.payloadStart, s3.end), r3)) a2++;
              else n2.push(e3.subarray(s3.start, s3.end));
            }
            return { body: a2 ? join(n2) : e3, removed: a2, entries: i4 };
          }
          function object(e3) {
            return !!e3 && typeof e3 === "object" && !Array.isArray(e3);
          }
          function jsonAdEntry(e3) {
            var r3 = e3 && e3.command && e3.command.reelWatchEndpoint;
            return object(r3) && object(r3.adClientParams) && r3.adClientParams.isAd === true;
          }
          function cleanJSON(e3) {
            var r3 = JSON.parse(e3), t2 = [r3], n2 = 0, a2 = 0, i4 = 0;
            while (t2.length) {
              var o4 = t2.pop();
              if (!o4 || typeof o4 !== "object") continue;
              if (++n2 > c) fail("json-limit");
              if (Array.isArray(o4)) {
                for (var s3 = 0; s3 < o4.length; s3++) t2.push(o4[s3]);
                continue;
              }
              var u3 = Object.keys(o4);
              for (var l2 = 0; l2 < u3.length; l2++) {
                var f2 = u3[l2], d2 = o4[f2];
                if (f2 === "entries" && Array.isArray(d2)) {
                  i4 += d2.length;
                  o4[f2] = d2.filter(function(e4) {
                    if (jsonAdEntry(e4)) {
                      a2++;
                      return false;
                    }
                    return true;
                  });
                  d2 = o4[f2];
                }
                if (d2 && typeof d2 === "object") t2.push(d2);
              }
            }
            return { body: a2 ? JSON.stringify(r3) : e3, removed: a2, entries: i4 };
          }
          function run() {
            var t2 = p.exec(typeof e2 !== "undefined" ? e2.url || "" : "");
            if (!t2 || typeof r2 === "undefined" || !l) return {};
            f = "reel_watch_sequence";
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
            if ((i4 ? i4.length : a2.length) > d) {
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
            var o4 = /^(?:application\/(?:json|[\w.+-]+\+json)|text\/json)$/.test(n2), s3;
            if (typeof a2 === "string" || o4) {
              var u3 = a2;
              if (i4) {
                if (typeof TextDecoder !== "function") {
                  log("pass: no UTF-8 decoder");
                  return {};
                }
                u3 = new TextDecoder("utf-8", { fatal: true }).decode(i4);
              }
              s3 = cleanJSON(u3);
              if (s3.removed && i4) {
                if (typeof TextEncoder !== "function") {
                  log("pass: no UTF-8 encoder");
                  return {};
                }
                s3.body = new TextEncoder().encode(s3.body);
              }
            } else {
              if (!i4 || !/^(?:application\/(?:x-protobuf|protobuf|vnd\.google\.protobuf|octet-stream))$/.test(n2)) {
                log("pass: unsupported content type");
                return {};
              }
              s3 = cleanProto(i4, { fields: 0 });
            }
            log((s3.removed ? "changed" : "pass") + ": removed=" + s3.removed + " entries=" + s3.entries + " format=" + (typeof a2 === "string" || o4 ? "json" : "protobuf") + (s3.fieldSummary ? " player_fields=" + s3.fieldSummary : ""));
            return s3.removed ? { body: s3.body } : {};
          }
          var y = {};
          try {
            y = run();
          } catch (e3) {
            devFailure(e3);
            log("pass: " + (e3.ytNoAdsCode || "parse/schema check failed"));
          }
          if (typeof e2 !== "undefined" && typeof r2 !== "undefined" && p.test(e2.url || "")) devCapture("YouTubePlayback", "response", f, i3, y);
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
