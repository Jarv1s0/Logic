// devchristian1337; extracted from the previously vendored bundle. See SOURCE.md.
import { ytRuntimeInvoke } from "../legacy-runtime.mjs";
function YouTubeLogger(e, t) {
  return ytRuntimeInvoke(function(e2, r, n, a, i) {
    if (t) {
      e2 = { url: "http://youtube-logs.invalid" + t.path, method: "POST", headers: {} };
      r = void 0;
      i = t.done;
    }
    var o = Date.now();
    var s = null;
    try {
      var u = typeof $script !== "undefined" && $script ? $script.startTime : null;
      var l = u && typeof u.getTime === "function" ? u.getTime() : null;
      if (typeof l === "number" && Number.isFinite(l) && l >= 0 && l <= o) s = l;
    } catch (e3) {
    }
    function ytDiagnosticStampTiming(e3) {
      var t2 = Date.now(), r2 = e3.timing && typeof e3.timing === "object" && !Array.isArray(e3.timing) ? e3.timing : {};
      var n2 = t2 - o;
      if (Number.isFinite(n2) && n2 >= 0 && n2 <= 6e5) r2.jsBeforeIndexCommitMs = n2;
      if (s !== null) {
        var a2 = t2 - s;
        if (Number.isFinite(a2) && a2 >= 0 && a2 <= 6e5) r2.runtimeBeforeIndexCommitMs = a2;
      }
      if (Object.keys(r2).length) e3.timing = r2;
    }
    function ytDiagnosticShouldRecord(e3, t2, r2) {
      var n2 = t2 && t2.processing;
      var a2 = e3.level === "error" || !!(t2 && t2.responseBefore && Number(t2.responseBefore.status) >= 400 && Number(t2.responseBefore.status) <= 599) || !!(n2 && n2.exception) || /inner=(?:authentication_failed|compression_failed|invalid_config_key|protocol_cleanup_failed)/.test(e3.message);
      if (a2) e3.level = "error";
      if (r2 === "error") return a2;
      if (r2 === "warn") return a2 || e3.level === "warn";
      if (r2 !== "debug" && e3.level === "debug") e3.level = "info";
      return true;
    }
    function ytDiagnosticCommitEntry(e3, t2) {
      var r2 = "ytads.logger.config.v1", n2 = "ytads.logger.entries.v2";
      var i2 = JSON.parse(a.read(r2) || "null");
      if (!i2 || !i2.enabled || i2.session !== e3.session) throw Error("log-session-inactive");
      var o2 = a.read(n2);
      if (o2 && o2.length > 131072) throw Error("log-index-invalid");
      var s2 = o2 ? JSON.parse(o2) : null;
      var u2 = s2 && s2.session === e3.session && Array.isArray(s2.entries) ? s2 : { session: e3.session, entries: [], captureBytes: 0 };
      var l2 = e3.entries[e3.entries.length - 1];
      var f = l2.captureRef ? l2.captureRef.storedBytes : 0;
      var c = Number(u2.captureBytes || 0);
      if (!Number.isFinite(c) || c < 0 || !Number.isFinite(f) || f < 0) throw Error("log-index-invalid");
      var d = u2.entries.length >= 600 ? "entry-limit" : c + f > t2 ? "capture-budget-limit" : null;
      ytDiagnosticStampTiming(l2);
      var p = JSON.stringify({ session: e3.session, entries: u2.entries.concat([l2]), captureBytes: c + f });
      if (!d && unescape(encodeURIComponent(p)).length > 131072) d = "log-index-limit";
      if (d) {
        i2.enabled = false;
        i2.haltReason = d;
        i2.haltedAt = (/* @__PURE__ */ new Date()).toISOString();
        if (a.write(JSON.stringify(i2), r2) !== true) throw Error("log-stop-write-failed");
        throw Error(d);
      }
      if (a.write(p, n2) !== true) throw Error("log-index-write-failed");
      return true;
    }
    function ytDiagnosticPurgeLegacy() {
      if (typeof a === "undefined") return;
      var e3 = "ytads.logger.privacy.v1";
      if (a.read(e3) === "structure-only-v1") return;
      var t2 = a.read("ytads.logger.entries.v2"), r2 = t2 ? JSON.parse(t2) : null;
      if (r2 && Array.isArray(r2.entries)) {
        for (var n2 = 0; n2 < r2.entries.length; n2++) {
          var i2 = r2.entries[n2], o2 = i2 && i2.captureRef;
          if (!o2) continue;
          if (typeof o2.prefix !== "string" || !/^ytads\.capture\.[a-z0-9-]+\.[a-z0-9-]+\.$/.test(o2.prefix) || !Number.isInteger(o2.chunks) || o2.chunks < 1 || o2.chunks > 256) throw Error("privacy-invalid-reference");
          for (var s2 = 0; s2 < o2.chunks; s2++) if (a.write(void 0, o2.prefix + s2) !== true) throw Error("privacy-delete-failed");
          delete i2.captureRef;
          i2.message = "legacy capture removed for privacy";
        }
        r2.captureBytes = 0;
        if (a.write(JSON.stringify(r2), "ytads.logger.entries.v2") !== true) throw Error("privacy-index-failed");
      }
      if (a.write("structure-only-v1", e3) !== true) throw Error("privacy-marker-failed");
    }
    function ytDiagnosticUMPStructure(e3, t2) {
      var r2 = 8 * 1048576, n2 = 0, i2 = null;
      var o2 = { format: "ump", bytes: e3.length, parts: [], complete: true };
      function fail(e4) {
        throw Error(e4);
      }
      function umpInt() {
        if (n2 >= e3.length) fail("ump-truncated-integer");
        var t3 = e3[n2++], r3 = t3 < 128 ? 1 : t3 < 192 ? 2 : t3 < 224 ? 3 : t3 < 240 ? 4 : 5, a2 = 8 - r3, i3 = r3 === 5 ? 0 : t3 % Math.pow(2, a2), o3 = r3 === 5 ? 1 : Math.pow(2, a2);
        for (var s3 = 1; s3 < r3; s3++) {
          if (n2 >= e3.length) fail("ump-truncated-integer");
          i3 += e3[n2++] * o3;
          o3 *= 256;
        }
        return i3;
      }
      function records(e4) {
        var t3 = 0, r3 = [];
        function integer() {
          var r4 = 0, n4 = 1;
          for (var a3 = 0; a3 < 10 && t3 < e4.length; a3++) {
            var i4 = e4[t3++];
            r4 += (i4 & 127) * n4;
            if (i4 < 128) {
              if (!Number.isSafeInteger(r4)) fail("integer-range");
              return r4;
            }
            n4 *= 128;
          }
          fail("protobuf-truncated");
        }
        while (t3 < e4.length) {
          if (r3.length >= 3e4) fail("field-limit");
          var n3 = integer(), a2 = n3 % 8, i3 = Math.floor(n3 / 8), o3 = { field: i3, wire: a2 };
          if (!i3 || i3 > 536870911) fail("invalid-field");
          if (a2 === 0) o3.value = integer();
          else if (a2 === 2) {
            var s3 = integer();
            if (s3 > e4.length - t3) fail("protobuf-truncated");
            o3.body = e4.subarray(t3, t3 + s3);
            t3 += s3;
          } else if (a2 === 1 || a2 === 5) t3 += a2 === 1 ? 8 : 4;
          else fail("unsupported-wire");
          if (t3 > e4.length) fail("protobuf-truncated");
          r3.push(o3);
        }
        return r3;
      }
      function only(e4, t3, r3) {
        var n3 = null;
        for (var a2 = 0; a2 < e4.length; a2++) if (e4[a2].field === t3) {
          if (n3 || e4[a2].wire !== r3) fail("schema-mismatch");
          n3 = e4[a2];
        }
        return n3;
      }
      function concat(e4) {
        var t3 = 0, r3 = 0;
        for (var n3 = 0; n3 < e4.length; n3++) t3 += e4[n3].length;
        var a2 = new Uint8Array(t3);
        for (n3 = 0; n3 < e4.length; n3++) {
          a2.set(e4[n3], r3);
          r3 += e4[n3].length;
        }
        return a2;
      }
      function localKey() {
        if (typeof a === "undefined") fail("config-absent");
        var e4 = a.read("ytads.onesie.youtube.v1"), t3 = e4 && e4.length <= 8192 ? JSON.parse(e4) : null;
        if (!t3 || t3.schema !== 1 || t3.platform !== "youtube" || !Number.isFinite(t3.expiresAt) || t3.expiresAt <= Date.now() || typeof t3.clientKey !== "string" || t3.clientKey.length !== 44) fail("config-absent");
        var r3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", n3 = [], i3 = 0, o3 = 0;
        for (var s3 = 0; s3 < t3.clientKey.length && t3.clientKey[s3] !== "="; s3++) {
          var u3 = r3.indexOf(t3.clientKey[s3]);
          if (u3 < 0) fail("config-invalid");
          i3 = i3 << 6 | u3;
          o3 += 6;
          if (o3 >= 8) {
            o3 -= 8;
            n3.push(i3 >>> o3 & 255);
          }
        }
        if (n3.length !== 32) fail("config-invalid");
        return new Uint8Array(n3);
      }
      function rotate(e4, t3) {
        return e4 >>> t3 | e4 << 32 - t3;
      }
      function sha256(e4) {
        var t3 = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
        var r3 = e4.length, n3 = Math.ceil((r3 + 9) / 64) * 64, a2 = new Uint8Array(n3), i3 = new DataView(a2.buffer), o3 = r3 * 8;
        a2.set(e4);
        a2[r3] = 128;
        i3.setUint32(n3 - 8, Math.floor(o3 / 4294967296));
        i3.setUint32(n3 - 4, o3 >>> 0);
        var s3 = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225], u3 = new Uint32Array(64);
        for (var l3 = 0; l3 < n3; l3 += 64) {
          for (var f2 = 0; f2 < 16; f2++) u3[f2] = i3.getUint32(l3 + f2 * 4);
          for (f2 = 16; f2 < 64; f2++) {
            var c2 = rotate(u3[f2 - 15], 7) ^ rotate(u3[f2 - 15], 18) ^ u3[f2 - 15] >>> 3, d2 = rotate(u3[f2 - 2], 17) ^ rotate(u3[f2 - 2], 19) ^ u3[f2 - 2] >>> 10;
            u3[f2] = u3[f2 - 16] + c2 + u3[f2 - 7] + d2 >>> 0;
          }
          var p2 = s3[0], g2 = s3[1], y = s3[2], v = s3[3], h = s3[4], m = s3[5], b = s3[6], w = s3[7];
          for (f2 = 0; f2 < 64; f2++) {
            var x = rotate(h, 6) ^ rotate(h, 11) ^ rotate(h, 25), S = h & m ^ ~h & b, k = w + x + S + t3[f2] + u3[f2] >>> 0, A = rotate(p2, 2) ^ rotate(p2, 13) ^ rotate(p2, 22), _ = p2 & g2 ^ p2 & y ^ g2 & y, O = A + _ >>> 0;
            w = b;
            b = m;
            m = h;
            h = v + k >>> 0;
            v = y;
            y = g2;
            g2 = p2;
            p2 = k + O >>> 0;
          }
          s3[0] = s3[0] + p2 >>> 0;
          s3[1] = s3[1] + g2 >>> 0;
          s3[2] = s3[2] + y >>> 0;
          s3[3] = s3[3] + v >>> 0;
          s3[4] = s3[4] + h >>> 0;
          s3[5] = s3[5] + m >>> 0;
          s3[6] = s3[6] + b >>> 0;
          s3[7] = s3[7] + w >>> 0;
        }
        var E = new Uint8Array(32), C = new DataView(E.buffer);
        for (f2 = 0; f2 < 8; f2++) C.setUint32(f2 * 4, s3[f2]);
        return E;
      }
      function hmac256(e4, t3) {
        if (e4.length > 64) e4 = sha256(e4);
        var r3 = new Uint8Array(64 + t3.length), n3 = new Uint8Array(96);
        for (var a2 = 0; a2 < 64; a2++) {
          var i3 = a2 < e4.length ? e4[a2] : 0;
          r3[a2] = i3 ^ 54;
          n3[a2] = i3 ^ 92;
        }
        r3.set(t3, 64);
        n3.set(sha256(r3), 64);
        return sha256(n3);
      }
      function equal(e4, t3) {
        if (!e4 || !t3 || e4.length !== t3.length) return false;
        var r3 = 0;
        for (var n3 = 0; n3 < e4.length; n3++) r3 |= e4[n3] ^ t3[n3];
        return r3 === 0;
      }
      var s2 = new Uint8Array([99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22]);
      function aesSchedule(e4) {
        if (!e4 || e4.length !== 16) fail("invalid-aes-key");
        var t3 = new Uint8Array(176);
        t3.set(e4);
        var r3 = 16, n3 = 1, a2 = new Uint8Array(4);
        while (r3 < 176) {
          for (var i3 = 0; i3 < 4; i3++) a2[i3] = t3[r3 - 4 + i3];
          if (r3 % 16 === 0) {
            var o3 = a2[0];
            a2[0] = s2[a2[1]] ^ n3;
            a2[1] = s2[a2[2]];
            a2[2] = s2[a2[3]];
            a2[3] = s2[o3];
            n3 = (n3 << 1 ^ (n3 & 128 ? 27 : 0)) & 255;
          }
          for (i3 = 0; i3 < 4; i3++) {
            t3[r3] = t3[r3 - 16] ^ a2[i3];
            r3++;
          }
        }
        return t3;
      }
      function aesBlock(e4, t3) {
        var r3 = new Uint8Array(e4), n3, a2, i3, o3, u3, l3, f2, c2;
        function addKey(e5) {
          for (a2 = 0; a2 < 16; a2++) r3[a2] ^= t3[e5 + a2];
        }
        function xtime(e5) {
          return (e5 << 1 ^ (e5 & 128 ? 27 : 0)) & 255;
        }
        addKey(0);
        for (n3 = 1; n3 <= 10; n3++) {
          for (a2 = 0; a2 < 16; a2++) r3[a2] = s2[r3[a2]];
          c2 = r3[1];
          r3[1] = r3[5];
          r3[5] = r3[9];
          r3[9] = r3[13];
          r3[13] = c2;
          c2 = r3[2];
          r3[2] = r3[10];
          r3[10] = c2;
          c2 = r3[6];
          r3[6] = r3[14];
          r3[14] = c2;
          c2 = r3[3];
          r3[3] = r3[15];
          r3[15] = r3[11];
          r3[11] = r3[7];
          r3[7] = c2;
          if (n3 < 10) for (i3 = 0; i3 < 4; i3++) {
            a2 = i3 * 4;
            o3 = r3[a2];
            u3 = r3[a2 + 1];
            l3 = r3[a2 + 2];
            f2 = r3[a2 + 3];
            c2 = o3 ^ u3 ^ l3 ^ f2;
            r3[a2] = o3 ^ c2 ^ xtime(o3 ^ u3);
            r3[a2 + 1] = u3 ^ c2 ^ xtime(u3 ^ l3);
            r3[a2 + 2] = l3 ^ c2 ^ xtime(l3 ^ f2);
            r3[a2 + 3] = f2 ^ c2 ^ xtime(f2 ^ o3);
          }
          addKey(n3 * 16);
        }
        return r3;
      }
      function incrementCounter(e4) {
        for (var t3 = 15; t3 >= 0; t3--) {
          e4[t3] = e4[t3] + 1 & 255;
          if (e4[t3] !== 0) return;
        }
      }
      function aesCtr(e4, t3, r3) {
        if (!r3 || r3.length !== 16) fail("invalid-aes-iv");
        var n3 = aesSchedule(t3), a2 = new Uint8Array(r3), i3 = new Uint8Array(e4.length);
        for (var o3 = 0; o3 < e4.length; o3 += 16) {
          var s3 = aesBlock(a2, n3), u3 = Math.min(16, e4.length - o3);
          for (var l3 = 0; l3 < u3; l3++) i3[o3 + l3] = e4[o3 + l3] ^ s3[l3];
          incrementCounter(a2);
        }
        return i3;
      }
      function player(e4, n3) {
        var a2 = records(n3), i3 = only(a2, 1, 0);
        if (i3 && i3.value !== 0) return { status: "non-player-onesie" };
        var o3 = only(a2, 4, 2), s3 = e4, u3 = "clear";
        if (!o3) fail("crypto-params-absent");
        var l3 = records(o3.body), f2 = only(l3, 5, 2), c2 = only(l3, 4, 2), d2 = only(l3, 6, 0);
        if (!f2 || !c2) fail("crypto-params-absent");
        if (f2.body.length || c2.body.length) {
          if (f2.body.length !== 16 || c2.body.length !== 32) fail("crypto-params-invalid");
          var p2 = localKey();
          if (!equal(hmac256(p2.subarray(16), concat([e4, f2.body])), c2.body)) fail("authentication-failed");
          s3 = aesCtr(e4, p2.subarray(0, 16), f2.body);
          u3 = "authenticated";
        }
        if (s3.length > r2) fail("player-size-limit");
        if (d2 && d2.value !== 0 && d2.value !== 1) fail("compression-unsupported");
        if (d2 && d2.value === 1) {
          if (typeof $utils === "undefined" || typeof $utils.ungzip !== "function") fail("gzip-unavailable");
          s3 = $utils.ungzip(s3);
          if (s3 instanceof ArrayBuffer) s3 = new Uint8Array(s3);
          if (!(s3 instanceof Uint8Array) || s3.length > r2) fail("gzip-invalid");
        }
        var g2 = records(s3), y = only(g2, 2, 0), v = only(g2, 1, 0), h = only(g2, 4, 2);
        var m = { status: u3, httpStatus: y && y.value, proxyStatus: v && v.value };
        if (h) m.player = t2(h.body);
        else m.status = "player-body-absent";
        return m;
      }
      function cues(e4) {
        var t3 = records(e4), r3 = [];
        for (var n3 = 0; n3 < t3.length; n3++) {
          if (t3[n3].field !== 1 || t3[n3].wire !== 2) continue;
          var a2 = records(t3[n3].body), i3 = only(a2, 1, 2);
          if (!i3) continue;
          var o3 = records(i3.body), s3 = only(o3, 1, 0), u3 = only(o3, 2, 0);
          if (s3 && u3 && s3.value >= 0 && s3.value <= 255 && u3.value >= 0 && u3.value <= 255) r3.push({ type: s3.value, event: u3.value, ad: s3.value === 1, prefetch: s3.value === 1 && u3.value === 6 });
        }
        return r3;
      }
      try {
        while (n2 < e3.length) {
          if (o2.parts.length >= 1e4) {
            o2.complete = false;
            o2.reason = "part-limit";
            break;
          }
          var u2 = umpInt(), l2 = umpInt(), f = Math.min(l2, e3.length - n2), c = e3.subarray(n2, n2 + f);
          n2 += f;
          var d = { type: u2, bytes: l2, observedBytes: f };
          o2.parts.push(d);
          if (f !== l2) {
            d.omitted = "partial-part";
            o2.complete = false;
            o2.reason = "partial-part";
            break;
          }
          if (u2 === 10) {
            i2 = null;
            if (l2 > r2) {
              d.omitted = "metadata-size-limit";
              continue;
            }
            try {
              var p = records(c), g = only(p, 1, 0);
              d.headerType = g ? g.value : 0;
              i2 = c;
              d.cryptoPresent = !!only(p, 4, 2);
            } catch (e4) {
              d.omitted = "header-invalid";
            }
          } else if (u2 === 11) {
            if (!i2) {
              d.omitted = "header-absent";
              continue;
            }
            if (l2 > r2) {
              d.omitted = "metadata-size-limit";
              i2 = null;
              continue;
            }
            try {
              d.onesie = player(c, i2);
            } catch (e4) {
              d.onesie = { status: /^(config-absent|config-invalid|authentication-failed|crypto-params-absent|crypto-params-invalid|compression-unsupported|gzip-unavailable|gzip-invalid|player-size-limit|schema-mismatch|protobuf-truncated|unsupported-wire|invalid-field|field-limit|integer-range)$/.test(e4.message) ? e4.message : "player-parse-failed" };
            }
            i2 = null;
          } else if ([20, 22, 31, 35, 36, 37, 38, 42, 43, 44, 45, 46, 47, 48, 51, 54, 55, 58, 62, 66, 67, 68, 69, 70, 71, 72].indexOf(u2) >= 0) {
            if (l2 > r2) d.omitted = "metadata-size-limit";
            else {
              d.structure = t2(c);
              if (u2 === 69) try {
                d.cues = cues(c);
              } catch (e4) {
                d.cueStatus = "schema-unrecognized";
              }
            }
          } else d.omitted = u2 === 21 ? "media-content" : u2 === 12 ? "encrypted-media" : "unknown-or-sensitive-part";
        }
      } catch (e4) {
        o2.complete = false;
        o2.reason = "ump-framing-invalid";
      }
      return o2;
    }
    function ytDiagnosticQuality(e3, t2) {
      var r2 = { schema: 1, purpose: "quality-research", actualRenderedQuality: "not-observed" };
      function number(e4, t3) {
        return typeof e4 === "number" && Number.isSafeInteger(e4) && e4 >= 0 && e4 <= t3 ? e4 : null;
      }
      function bytes(e4, r3) {
        if (!e4 || e4.available !== true || !Number.isSafeInteger(e4.bytes) || e4.bytes > r3) return null;
        return e4.memoryBytes instanceof Uint8Array ? e4.memoryBytes : e4.encoding === "base64" ? t2(e4.data) : null;
      }
      function fields(e4) {
        var t3 = 0, r3 = [];
        function integer() {
          var r4 = 0, n4 = 1;
          for (var a4 = 0; a4 < 10 && t3 < e4.length; a4++) {
            var i4 = e4[t3++];
            if (a4 === 9 && i4 > 1) throw Error("varint");
            r4 += (i4 & 127) * n4;
            if (i4 < 128) return Number.isSafeInteger(r4) ? r4 : null;
            n4 *= 128;
          }
          throw Error("varint");
        }
        while (t3 < e4.length) {
          if (r3.length >= 512) throw Error("fields-limit");
          var n3 = integer();
          if (!n3 || n3 > 4294967295) throw Error("tag");
          var a3 = Math.floor(n3 / 8), i3 = n3 % 8, o3 = { field: a3, wire: i3 };
          if (i3 === 0) o3.value = integer();
          else if (i3 === 1 || i3 === 5) t3 += i3 === 1 ? 8 : 4;
          else if (i3 === 2) {
            var s3 = integer();
            if (s3 === null || s3 > e4.length - t3) throw Error("length");
            o3.bytes = e4.subarray(t3, t3 + s3);
            t3 += s3;
          } else throw Error("wire");
          if (t3 > e4.length) throw Error("truncated");
          r3.push(o3);
        }
        return r3;
      }
      function abr(e4) {
        var t3 = fields(e4), r3 = { status: "schema-candidate", schema: "LuanRT/googlevideo VideoPlaybackAbrRequest", iosSchemaVerified: false }, n3 = {}, a3 = { initialization: [], audio: [], video: [] }, i3 = false;
        var o3 = { 13: ["timeSinceLastManualSelectionMs", 864e5], 16: ["lastManualSelectedResolution", 8640], 18: ["viewportWidth", 32768], 19: ["viewportHeight", 32768], 20: ["bitrateCapBytesPerSecond", 1e9], 21: ["stickyResolution", 8640], 23: ["bandwidthEstimate", 1e12], 26: ["videoQualitySetting", 3], 30: ["dataSaverMode", 1], 62: ["supportsQualityConstraints", 1] };
        for (var s3 = 0; s3 < t3.length; s3++) {
          var u3 = t3[s3];
          if (u3.field === 1 && u3.wire === 2) {
            var l3 = fields(u3.bytes);
            for (var f = 0; f < l3.length; f++) {
              var c = l3[f], d = o3[c.field], p = d && c.wire === 0 ? number(c.value, d[1]) : null;
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
        var t3 = e4 && e4.streamingData || e4 && e4.playerResponse && e4.playerResponse.streamingData;
        if (!t3) return { status: "no-json-streaming-data" };
        var r3 = { status: "observed-json-formats", formats: [] }, n3 = { itag: 65535, width: 32768, height: 32768, fps: 240, bitrate: 1e9, averageBitrate: 1e9, audioSampleRate: 384e3, audioChannels: 32 };
        var a3 = [t3.formats, t3.adaptiveFormats];
        for (var i3 = 0; i3 < a3.length; i3++) {
          var o3 = a3[i3];
          if (!Array.isArray(o3)) continue;
          for (var s3 = 0; s3 < o3.length && r3.formats.length < 128; s3++) {
            var u3 = o3[s3];
            if (!u3 || typeof u3 !== "object") continue;
            var l3 = { source: i3 === 0 ? "formats" : "adaptiveFormats" };
            for (var f in n3) {
              var c = number(u3[f], n3[f]);
              if (c !== null) l3[f] = c;
            }
            if (typeof u3.qualityLabel === "string" && /^(?:144|240|360|480|720|1080|1440|2160|2880|4320|8640)p(?:48|50|60|90|120)?$/.test(u3.qualityLabel)) l3.qualityLabel = u3.qualityLabel;
            if (typeof u3.mimeType === "string") {
              var d = /^(video|audio)\/(mp4|webm)(?:\s*;|$)/.exec(u3.mimeType);
              if (d) l3.container = d[1] + "/" + d[2];
            }
            l3.hasDirectUrl = typeof u3.url === "string" && /^https:\/\//.test(u3.url);
            l3.hasCipher = typeof u3.signatureCipher === "string" || typeof u3.cipher === "string";
            if (Object.keys(l3).length > 3) r3.formats.push(l3);
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
              var l2 = bytes(s2, 4194304);
              if (l2 && (l2[0] === 123 || l2[0] === 91) && typeof TextDecoder === "function") u2 = new TextDecoder("utf-8", { fatal: true }).decode(l2);
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
      var t2 = /(?:[a-z_]+\.eml-fe\|[0-9a-f]{16}|skip_ad_on_block|googleadservices\.com\/pagead\/|youtube\.com\/pagead\/|yt-ads-web-view-id|FEwhat_to_watch|FEsubscriptions|FEshorts)/g;
      function labels(e4) {
        return (String(e4).match(t2) || []).map(function(e5) {
          return e5.replace(/\|[0-9a-f]{16}$/, "|0000000000000000");
        });
      }
      function url(e4) {
        var t3 = /^(https?:\/\/[^/?#]+)(\/[^?#]*)?/.exec(String(e4 || ""));
        return t3 ? t3[1] + (t3[2] || "/") : "[removed]";
      }
      function headers(e4) {
        var t3 = {};
        Object.keys(e4 || {}).forEach(function(r3) {
          var n2 = String(e4[r3]);
          if (/^(content-type|content-length|content-encoding|accept-encoding)$/i.test(r3) && /^[a-z0-9\s/.,;+_=\-]{0,160}$/i.test(n2) || /^transfer-encoding$/i.test(r3) && /^(?:chunked|gzip|deflate|br|identity)(?:,\s*(?:chunked|gzip|deflate|br|identity))*$/i.test(n2) || /^accept-ranges$/i.test(r3) && /^(?:bytes|none)$/i.test(n2) || /^content-range$/i.test(r3) && /^bytes (?:\d+-\d+|\*)\/(?:\d+|\*)$/.test(n2)) t3[r3] = n2;
        });
        return t3;
      }
      function decode(e4) {
        var t3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", r3 = [], n2 = 0, a2 = 0;
        for (var i2 = 0; i2 < e4.length && e4[i2] !== "="; i2++) {
          var o2 = t3.indexOf(e4[i2]);
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
      function proto(e4, t3) {
        if (t3 > 32 || r2 > 3e4) return { bytes: e4.length, omitted: true };
        var n2 = 0, a2 = [];
        function integer() {
          var t4 = 0, r3 = 1;
          for (var a3 = 0; a3 < 10 && n2 < e4.length; a3++) {
            var i3 = e4[n2++];
            t4 += (i3 & 127) * r3;
            if (i3 < 128) return t4;
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
            var l2 = integer();
            u2.value = l2 === 0 || l2 === 1 ? l2 : "[removed]";
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
              u2.fields = proto(d, t3 + 1);
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
      function json(e4, t3) {
        if (t3 > 32) return "[omitted]";
        if (typeof e4 === "string") return { chars: e4.length, markers: labels(e4) };
        if (typeof e4 === "number") return e4 === 0 || e4 === 1 ? e4 : "[removed]";
        if (Array.isArray(e4)) return e4.map(function(e5) {
          return json(e5, t3 + 1);
        });
        if (e4 && typeof e4 === "object") {
          var r3 = {};
          Object.keys(e4).forEach(function(n2) {
            if (!/token|cookie|auth|visitor|account|signature|clientkey|encryptkey|trackingparams|clicktracking/i.test(n2) && /^[a-zA-Z_][a-zA-Z0-9_]{0,80}$/.test(n2)) r3[n2] = json(e4[n2], t3 + 1);
          });
          return r3;
        }
        return e4;
      }
      function apiStructure(e4) {
        try {
          var t3 = typeof TextDecoder === "function" && (e4[0] === 123 || e4[0] === 91) ? new TextDecoder("utf-8", { fatal: true }).decode(e4) : null;
          return t3 ? json(JSON.parse(t3), 0) : proto(e4, 0);
        } catch (t4) {
          return { bytes: e4.length, omitted: true };
        }
      }
      function body(t3, r3, n2) {
        if (!t3 || t3.reference || !t3.available) return t3;
        var a2 = { available: false, reason: "privacy-structure-only", bytes: t3.bytes, redacted: true };
        if (!n2 && /^(config|log_event)$/.test(e3.endpoint)) return a2;
        if (!n2 && /^(initplayback|ump)$/.test(e3.endpoint)) {
          if (r3) return a2;
          try {
            var i2 = t3.memoryBytes instanceof Uint8Array ? t3.memoryBytes : t3.encoding === "base64" ? decode(t3.data) : null;
            if (i2) a2.structure = ytDiagnosticUMPStructure(i2, apiStructure);
            else a2.reason = "unsupported-ump-body";
          } catch (e4) {
            a2.reason = "ump-analysis-failed";
          }
          return a2;
        }
        try {
          var o2 = t3.encoding === "base64" ? decode(t3.data) : null;
          if (o2) {
            try {
              var s2 = typeof TextDecoder === "function" && (o2[0] === 123 || o2[0] === 91) ? new TextDecoder("utf-8", { fatal: true }).decode(o2) : null;
              a2.structure = s2 ? json(JSON.parse(s2), 0) : proto(o2, 0);
            } catch (e4) {
              a2.structure = { bytes: o2.length, omitted: true };
            }
          } else a2.structure = json(JSON.parse(t3.data), 0);
        } catch (e4) {
          a2.structure = { omitted: true };
        }
        return a2;
      }
      if (!e3.privacy && typeof $loon === "string" && typeof n === "object" && n && (n.log_enabled === true || n.log_enabled === "true") && (n.quality_research === true || n.quality_research === "true") && /^(ump|player|get_watch)$/.test(e3.endpoint)) {
        e3.qualityResearch = ytDiagnosticQuality(e3, decode);
      }
      ["request", "requestAfter", "requestInner", "requestInnerAfter", "responseBefore", "responseAfter"].forEach(function(t3) {
        var r3 = e3[t3];
        if (!r3) return;
        var n2 = {};
        ["status", "method", "synthetic", "changed", "transportHeadersRecomputedByLoon"].forEach(function(e4) {
          if (r3[e4] !== void 0) n2[e4] = r3[e4];
        });
        if (r3.url) n2.url = url(r3.url);
        if (r3.headers) n2.headers = headers(r3.headers);
        if (r3.headerOverrides) n2.headerOverrides = headers(r3.headerOverrides);
        n2.body = body(r3.body, t3 === "request" || t3 === "requestAfter", t3 === "requestInner" || t3 === "requestInnerAfter");
        e3[t3] = n2;
      });
      if (e3.processing && e3.processing.exception) e3.processing.exception = { code: "processing-failed" };
      e3.privacy = "structure-only-v1";
      return e3;
    }
    (function() {
      "use strict";
      var t2 = "ytads.logger.config.v1";
      var o2 = "ytads.logger.entries.v2";
      var s2 = ["YouTubeFeed", "YouTubePlayback", "YouTubeConfig", "YouTubeLogger"];
      var u2 = ["YouTubePlayerRequest", "YouTubePlaybackAds", "YouTubeStreamAds", "YouTubeFeedAds", "YouTubeShortsAds", "YouTubeAdBreak", "YouTubeOnesieConfig", "YouTubeInitPlayback"];
      var l2 = s2.concat(u2);
      var f = "http://youtube-logs.invalid/";
      var c = "3.3.0";
      var d = 600;
      var p = /^https:\/\/(?:youtubei(?:-att)?\.googleapis\.com|(?:www\.|m\.|music\.)?youtube\.com)\/youtubei\/v1\/(player|get_watch|browse|next|search|reel\/reel_watch_sequence|log_event|config)(?:\?[^#]*)?$/i;
      var g = /^https:\/\/[\w-]+\.googlevideo\.com\/(videoplayback|initplayback)(?:\?[^#]*)?$/i;
      var y = typeof n === "object" && n ? n : {};
      y.log_level = String(y.log_level || "info").toLowerCase();
      if (typeof y.capture_raw === "undefined") y.capture_raw = y.log_enabled;
      var v = { debug: 0, info: 1, warn: 2, error: 3 };
      var h = Object.prototype.hasOwnProperty.call(v, y.log_level) ? y.log_level : "info";
      var m = [];
      var b = Date.now();
      function devFlag(e3) {
        return e3 === true || e3 === "true";
      }
      function devConfig() {
        if (!devFlag(y.log_enabled) || typeof a === "undefined") return null;
        var e3 = a.read("ytads.logger.config.v1");
        var t3 = e3 && e3.length <= 2048 ? JSON.parse(e3) : null;
        return t3 && t3.enabled === true && typeof t3.session === "string" && /^[a-z0-9-]{1,80}$/.test(t3.session) ? t3 : null;
      }
      function devUTF8Size(e3) {
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
      function devBase64(e3) {
        var t3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var r2 = [], n2 = "";
        for (var a2 = 0; a2 < e3.length; a2 += 3) {
          var i2 = e3[a2], o3 = a2 + 1 < e3.length ? e3[a2 + 1] : 0, s3 = a2 + 2 < e3.length ? e3[a2 + 2] : 0;
          n2 += t3[i2 >> 2] + t3[(i2 & 3) << 4 | o3 >> 4] + (a2 + 1 < e3.length ? t3[(o3 & 15) << 2 | s3 >> 6] : "=") + (a2 + 2 < e3.length ? t3[s3 & 63] : "=");
          if (n2.length >= 32768) {
            r2.push(n2);
            n2 = "";
          }
        }
        r2.push(n2);
        return r2.join("");
      }
      function devBody(e3) {
        if (e3 === void 0 || e3 === null) return { available: false, reason: "not-provided-by-runtime" };
        if (typeof e3 === "string") {
          var t3 = devUTF8Size(e3);
          if (t3 > 8388608) throw new Error("capture-body-limit");
          return { available: true, encoding: "utf8-text", bytes: t3, data: e3 };
        }
        var r2;
        if (e3 instanceof Uint8Array) r2 = e3;
        else if (e3 instanceof ArrayBuffer) r2 = new Uint8Array(e3);
        else if (ArrayBuffer.isView(e3)) r2 = new Uint8Array(e3.buffer, e3.byteOffset, e3.byteLength);
        else return { available: false, reason: "unsupported-runtime-body-type" };
        if (r2.length > 8388608) throw new Error("capture-body-limit");
        return { available: true, encoding: "base64", bytes: r2.length, data: devBase64(r2) };
      }
      function devMediaBody(e3, t3) {
        if (e3 === void 0 || e3 === null) return { available: false, reason: "not-provided-by-runtime" };
        var r2 = String(t3 && (t3["Content-Type"] || t3["content-type"]) || "");
        if (!/^application\/vnd\.yt-ump(?:\s*;|$)/i.test(r2)) return { available: false, reason: "unexpected-content-type" };
        var n2 = e3 instanceof Uint8Array ? e3 : e3 instanceof ArrayBuffer ? new Uint8Array(e3) : ArrayBuffer.isView(e3) ? new Uint8Array(e3.buffer, e3.byteOffset, e3.byteLength) : null;
        if (!n2) return { available: false, reason: "unsupported-runtime-body-type" };
        return { available: true, bytes: n2.length, memoryBytes: n2 };
      }
      function devHalt(e3, t3) {
        if (e3) {
          var r2 = JSON.parse(a.read("ytads.logger.config.v1") || "null");
          if (!r2 || !r2.enabled || r2.session !== e3.session) return;
          e3.enabled = false;
          e3.haltReason = t3;
          e3.haltedAt = (/* @__PURE__ */ new Date()).toISOString();
          a.write(JSON.stringify(e3), "ytads.logger.config.v1");
        }
        if (typeof console !== "undefined") console.log("[YouTubeLogger] recording-stopped: " + t3);
      }
      function devAppend(e3, t3) {
        var r2 = [], n2 = null;
        try {
          n2 = devConfig();
          if (!n2) return false;
          if (!ytDiagnosticShouldRecord(e3, t3, y.log_level)) return true;
          ytDiagnosticPurgeLegacy();
          var i2 = a.read("ytads.logger.entries.v2");
          if (i2 && devUTF8Size(i2) > 131072) throw new Error("log-index-invalid");
          var o3 = i2 ? JSON.parse(i2) : null;
          var s3 = o3 && o3.session === n2.session && Array.isArray(o3.entries) ? o3 : { session: n2.session, entries: [], captureBytes: 0 };
          if (s3.entries.length >= 600) {
            devHalt(n2, "entry-limit");
            return false;
          }
          var u3 = t3 ? JSON.stringify(ytDiagnosticSanitize(t3)) : null;
          if (u3 && u3.length > 33554432) {
            devHalt(n2, "capture-event-limit");
            return false;
          }
          var l3 = s3.captureBytes || 0;
          var f2 = [16, 32, 64].indexOf(Number(y.capture_budget)) >= 0 ? Number(y.capture_budget) * 1048576 : 33554432;
          var c2 = u3 ? devUTF8Size(u3) : 0;
          if (l3 + c2 > f2) {
            devHalt(n2, "capture-budget-limit");
            return false;
          }
          var d2 = [];
          if (u3) {
            for (var p2 = 0; p2 < u3.length; ) {
              var g2 = Math.min(p2 + 131072, u3.length);
              if (g2 < u3.length && u3.charCodeAt(g2 - 1) >= 55296 && u3.charCodeAt(g2 - 1) <= 56319 && u3.charCodeAt(g2) >= 56320 && u3.charCodeAt(g2) <= 57343) g2--;
              d2.push(u3.slice(p2, g2));
              p2 = g2;
            }
            if (d2.length > 256) {
              devHalt(n2, "capture-event-limit");
              return false;
            }
            var v2 = "ytads.capture." + n2.session + "." + t3.id + ".";
            e3.captureRef = { prefix: v2, chunks: d2.length, chars: u3.length, storedBytes: c2, checksum: devChecksum(u3) };
          }
          var h2 = { session: n2.session, entries: s3.entries.concat([e3]), captureBytes: l3 + c2 };
          var m2 = JSON.stringify(h2);
          if (devUTF8Size(m2) > 131072) {
            devHalt(n2, "log-index-limit");
            return false;
          }
          if (u3) {
            for (var b2 = 0; b2 < e3.captureRef.chunks; b2++) {
              var w2 = e3.captureRef.prefix + b2;
              if (a.write(d2[b2], w2) !== true) throw new Error("capture-write-failed");
              r2.push(w2);
            }
          }
          if (ytDiagnosticCommitEntry(h2, f2) !== true) throw new Error("log-index-write-failed");
          return true;
        } catch (e4) {
          r2.forEach(function(e5) {
            try {
              a.write(void 0, e5);
            } catch (e6) {
            }
          });
          try {
            devHalt(n2, "storage-or-serialization-failed");
          } catch (e5) {
          }
          return false;
        }
      }
      function devChecksum(e3) {
        var t3 = 2166136261;
        for (var r2 = 0; r2 < e3.length; r2++) {
          t3 ^= e3.charCodeAt(r2);
          t3 = Math.imul(t3, 16777619);
        }
        return "fnv1a32-utf16:" + ("00000000" + (t3 >>> 0).toString(16)).slice(-8);
      }
      function devCorrelation(e3, t3) {
        return devChecksum(e3 + " " + t3);
      }
      function devQualityBody(e3) {
        var t3 = e3 instanceof Uint8Array ? e3 : e3 instanceof ArrayBuffer ? new Uint8Array(e3) : ArrayBuffer.isView(e3) ? new Uint8Array(e3.buffer, e3.byteOffset, e3.byteLength) : null;
        return t3 && t3.length <= 262144 ? { available: true, bytes: t3.length, memoryBytes: t3 } : { available: false, reason: "quality-request-body-unavailable-or-too-large" };
      }
      function devCapture(t3, n2, a2, i2, o3, s3) {
        if (!devFlag(y.capture_raw)) return;
        var u3 = null;
        try {
          u3 = devConfig();
          if (!u3 || typeof e2 === "undefined") return;
          var l3 = (/* @__PURE__ */ new Date()).toISOString();
          var f2 = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
          var c2 = { url: e2.url, method: e2.method || "GET", headers: e2.headers || {}, h2_trailers: e2.h2_trailers || {}, body: !s3 && n2 === "request" && a2 === "ump" && devFlag(y.quality_research) && typeof $loon === "string" ? devQualityBody(e2.body) : s3 || /^(initplayback|ump)$/.test(a2) ? { available: false, reason: "request-not-buffered" } : devBody(e2.body) };
          var d2 = { schema: 1, id: f2, time: l3, source: t3, version: i2, phase: n2, endpoint: a2, runtime: typeof $loon === "string" ? $loon : null, correlation: { urlMethodHash: devCorrelation(c2.method, c2.url), exactPairing: false }, request: c2, processing: { exception: null, executionScript: n2 === "request" ? "YouTubeLogger" : t3, bodyBuffering: !s3, elapsedMs: Date.now() - b, messages: m.slice(), arguments: { development_capture: devFlag(y.capture_raw), background_playback: devFlag(y.background_playback), log_level: y.log_level || "info" } } };
          if (n2 === "response" && typeof r !== "undefined") {
            d2.responseBefore = { status: r.status, headers: r.headers || {}, h2_trailers: r.h2_trailers || {}, body: s3 ? { available: false, reason: "headers-only-not-buffered" } : /^(initplayback|ump)$/.test(a2) ? devMediaBody(r.body, r.headers) : devBody(r.body) };
            var p2 = o3 && Object.prototype.hasOwnProperty.call(o3, "body");
            d2.responseAfter = { changed: !!p2, status: o3 && o3.status !== void 0 ? o3.status : r.status, headerOverrides: o3 && o3.headers || null, transportHeadersRecomputedByLoon: true, body: p2 ? devBody(o3.body) : { reference: "responseBefore.body" } };
          }
          var g2 = "debug";
          if (n2 === "response" && /^(initplayback|ump)$/.test(a2)) {
            d2 = ytDiagnosticSanitize(d2);
            var v2 = d2.responseBefore.body.structure, h2 = [];
            if (v2 && v2.parts) for (var w2 = 0; w2 < v2.parts.length; w2++) {
              var x = v2.parts[w2].onesie;
              if (x && x.status && !/^(authenticated|clear|non-player-onesie|config-absent)$/.test(x.status)) h2.push(x.status);
            }
            if (h2.length) {
              g2 = "error";
              d2.processing.samplingErrors = h2;
            }
          }
          devAppend({ source: t3, version: i2, endpoint: a2, level: g2, time: l3, phase: n2, message: "development capture: " + n2 + (d2.responseAfter ? " changed=" + d2.responseAfter.changed : "") }, d2);
        } catch (e3) {
          try {
            devHalt(u3, e3.message === "capture-body-limit" ? "capture-body-limit" : "capture-serialization-failed");
          } catch (e4) {
          }
        }
      }
      function read(e3) {
        var t3 = a.read(e3);
        if (!t3) return null;
        if (typeof t3 !== "string" || t3.length > 131072) throw new Error("invalid-store");
        return JSON.parse(t3);
      }
      function config() {
        var e3 = read(t2);
        if (!e3 || typeof e3.session !== "string" || !/^[a-z0-9-]{1,80}$/.test(e3.session)) return null;
        return e3;
      }
      function write(e3, t3) {
        if (a.write(JSON.stringify(e3), t3) !== true) throw new Error("write-failed");
      }
      function shared(e3) {
        ytDiagnosticPurgeLegacy();
        var t3 = read(o2);
        if (t3) return t3;
        var r2 = [];
        l2.forEach(function(t4) {
          var n3 = read("ytads.logger." + t4 + ".v1");
          if (!n3 || n3.session !== e3.session || !Array.isArray(n3.entries)) return;
          n3.entries.slice(-300).forEach(function(e4) {
            if (!e4 || typeof e4.message !== "string") return;
            var n4 = e4.message.indexOf("changed:") === 0 ? "info" : e4.message === "pass: parse/schema check failed" ? "error" : /^(pass: (removed=|mode=|non-UMP))/.test(e4.message) ? "debug" : "warn";
            r2.push({ source: t4, level: n4, time: e4.time, version: e4.version, endpoint: e4.endpoint, message: e4.message });
          });
        });
        r2.sort(function(e4, t4) {
          return String(e4.time).localeCompare(String(t4.time));
        });
        var n2 = JSON.stringify({ session: e3.session, entries: r2.slice(-d), captureBytes: 0 });
        if (devUTF8Size(n2) > 131072) {
          devHalt(e3, "legacy-migration-limit");
          return { session: e3.session, entries: r2, captureBytes: 0, migrationDeferred: true };
        }
        if (a.write(n2, o2) !== true) throw new Error("write-failed");
        l2.forEach(function(e4) {
          a.write(void 0, "ytads.logger." + e4 + ".v1");
        });
        return JSON.parse(n2);
      }
      function records(e3) {
        var t3 = [];
        if (!e3) return t3;
        var r2 = shared(e3);
        if (!r2 || r2.session !== e3.session || !Array.isArray(r2.entries)) return t3;
        r2.entries.slice(-d).forEach(function(r3) {
          if (!r3 || l2.indexOf(r3.source) === -1 || !Object.prototype.hasOwnProperty.call(v, r3.level) || typeof r3.time !== "string" || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(r3.time) || typeof r3.version !== "string" || !/^\d+\.\d+\.\d+$/.test(r3.version) || !/^(player|get_watch|browse|next|search|reel_watch_sequence|log_event|config|initplayback|ad_break|ump|unknown)$/.test(r3.endpoint) || typeof r3.message !== "string" || r3.message.length > 600 || /[\r\n<>]/.test(r3.message)) return;
          var n2 = { time: r3.time, source: r3.source, level: r3.level, version: r3.version, endpoint: r3.endpoint, message: r3.message };
          if (r3.timing && typeof r3.timing === "object") {
            var a2 = {}, i2 = ["capturePrepareMs", "sampleWriteMs", "scriptBeforeIndexCommitMs", "jsBeforeIndexCommitMs", "runtimeBeforeIndexCommitMs"];
            for (var o3 = 0; o3 < i2.length; o3++) {
              var s3 = r3.timing[i2[o3]];
              if (typeof s3 === "number" && Number.isFinite(s3) && s3 >= 0 && s3 <= 6e5) a2[i2[o3]] = s3;
            }
            if (Object.keys(a2).length) n2.timing = a2;
          }
          if (r3.captureRef && typeof r3.captureRef.prefix === "string" && /^ytads\.capture\.[a-z0-9-]+\.[a-z0-9-]+\.$/.test(r3.captureRef.prefix) && r3.captureRef.prefix.indexOf("ytads.capture." + e3.session + ".") === 0 && Number.isInteger(r3.captureRef.chunks) && r3.captureRef.chunks > 0 && r3.captureRef.chunks <= 256 && Number.isInteger(r3.captureRef.chars) && r3.captureRef.chars > 0 && r3.captureRef.chars <= 33554432) {
            n2.captureRef = r3.captureRef;
            n2.phase = r3.phase;
          } else if (r3.captureRef) n2.captureError = "invalid-capture-reference";
          t3.push(n2);
        });
        t3.sort(function(e4, t4) {
          return e4.time < t4.time ? -1 : e4.time > t4.time ? 1 : 0;
        });
        return t3;
      }
      function response(e3, t3, r2, n2) {
        var a2 = { "Content-Type": r2 || "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
        Object.keys(n2 || {}).forEach(function(e4) {
          a2[e4] = n2[e4];
        });
        return { response: { status: e3, headers: a2, body: t3 } };
      }
      function developmentExport(e3, t3) {
        var r2 = [];
        var n2 = t3.map(function(e4) {
          var t4 = { summary: e4, capture: null };
          if (!e4.captureRef) {
            if (e4.captureError) {
              t4.captureError = e4.captureError;
              r2.push({ time: e4.time, source: e4.source, reason: e4.captureError });
            }
            return t4;
          }
          try {
            var n3 = [];
            for (var i2 = 0; i2 < e4.captureRef.chunks; i2++) {
              var o3 = a.read(e4.captureRef.prefix + i2);
              if (typeof o3 !== "string" || o3.length > 131072) throw new Error("missing-or-invalid-chunk");
              n3.push(o3);
            }
            var s3 = n3.join("");
            if (s3.length !== e4.captureRef.chars) throw new Error("capture-length-mismatch");
            if (devChecksum(s3) !== e4.captureRef.checksum) throw new Error("capture-checksum-mismatch");
            var u3 = JSON.parse(s3);
            if (u3.schema !== 1 || u3.source !== e4.source || u3.time !== e4.time || u3.phase !== e4.phase) throw new Error("capture-metadata-mismatch");
            t4.capture = u3;
          } catch (n4) {
            t4.captureError = "capture-unavailable-or-corrupt";
            r2.push({ time: e4.time, source: e4.source, reason: t4.captureError });
          }
          return t4;
        });
        return { schema: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), session: e3 && e3.session || null, recording: !!(e3 && e3.enabled), stoppedReason: e3 && e3.haltReason || null, coverage: coverage(t3), settings: { qualityResearch: typeof $loon === "string" && devFlag(y.quality_research), mediaCaptureMode: y.media_capture_mode === "full" ? "full" : "headers", rawCapture: devFlag(y.capture_raw), summaryMinimumLevel: h, budgetMB: [16, 32, 64].indexOf(Number(y.capture_budget)) >= 0 ? Number(y.capture_budget) : 32 }, completeness: { allReferencedSamplesReadable: r2.length === 0, stoppedDueToLimitOrError: !!(e3 && e3.haltReason), issues: r2, limitations: ["Only matched player/get_watch/browse/next/search/reel_watch_sequence/log_event/config/initplayback/player/ad_break and enabled UMP response scripts; not all YouTube traffic.", "Media headers mode does not buffer media bodies; full mode waits for complete bodies. Each event records its actual bodyBuffering value.", "Runtime bodies may already be decoded; these are not TLS/HTTP wire bytes.", "Missing runtime bodies are marked unavailable; before/after transport headers are not reconstructed.", "URL/method hashes are grouping hints, not guaranteed request/response pairs.", "Index is refreshed after sample writes; Loon has no atomic append, so simultaneous final commits may still lose entries.", "Script timeouts, TLS failures and requests bypassing MitM are not observed."] }, events: n2 };
      }
      function exportPage() {
        var e3 = "(" + browserExport.toString() + ")();";
        return response(200, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YouTube Export</title><p id="status">Reading local records, keep Loon running\u2026</p><a id="save" hidden>Save log file</a><p>Tap Save once the file is generated; in Safari you can also use the Share menu to store it in \u201CFiles\u201D.</p><script>' + e3 + "<\/script></html>", "text/html; charset=utf-8", { "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" });
      }
      async function browserExport(e3) {
        function shanghaiTime(e4) {
          var t4 = typeof e4 === "string" ? Date.parse(e4) : NaN;
          if (!Number.isFinite(t4)) return "unavailable";
          var r3 = new Date(t4 + 8 * 60 * 60 * 1e3);
          return Number.isFinite(r3.getTime()) ? r3.toISOString().replace(/Z$/, "+08:00") : "unavailable";
        }
        var t3 = document.getElementById("status"), r2 = document.getElementById("save"), n2 = document.getElementById("download");
        if (n2 && n2.disabled) return;
        if (n2) n2.disabled = true;
        try {
          let checksum = function(e4) {
            var t4 = 2166136261;
            for (var r3 = 0; r3 < e4.length; r3++) {
              t4 ^= e4.charCodeAt(r3);
              t4 = Math.imul(t4, 16777619);
            }
            return "fnv1a32-utf16:" + ("00000000" + (t4 >>> 0).toString(16)).slice(-8);
          }, value = function(e4) {
            if (e4 === null) return "null";
            if (e4 === void 0) return "unavailable";
            return typeof e4 === "string" ? e4.replace(/\r/g, "\\r").replace(/\n/g, "\\n") : String(e4);
          }, structure = function(e4, t4, r3, n3) {
            var a3 = new Array(n3 + 1).join("  ");
            if (t4 === null || t4 === void 0 || typeof t4 !== "object") {
              r3.push(a3 + e4 + ": " + value(t4));
              return;
            }
            if (Array.isArray(t4)) {
              r3.push(a3 + e4 + ": array(" + t4.length + ")");
              for (var i3 = 0; i3 < t4.length; i3++) structure("[" + i3 + "]", t4[i3], r3, n3 + 1);
              return;
            }
            if (Object.prototype.hasOwnProperty.call(t4, "field") && Object.prototype.hasOwnProperty.call(t4, "wire")) {
              var o4 = ["field", "wire", "bytes", "value"], s4 = [], u4 = Object.keys(t4).sort();
              for (var l4 = 0; l4 < o4.length; l4++) if (Object.prototype.hasOwnProperty.call(t4, o4[l4]) && (t4[o4[l4]] === null || typeof t4[o4[l4]] !== "object")) {
                s4.push(o4[l4] + "=" + JSON.stringify(t4[o4[l4]]));
                u4.splice(u4.indexOf(o4[l4]), 1);
              }
              r3.push(a3 + e4 + ": " + s4.join(" "));
              for (var f3 = 0; f3 < u4.length; f3++) structure(u4[f3], t4[u4[f3]], r3, n3 + 1);
              return;
            }
            var c3 = Object.keys(t4).sort();
            r3.push(a3 + e4 + ": object(" + c3.length + ")");
            for (var d3 = 0; d3 < c3.length; d3++) structure(c3[d3], t4[c3[d3]], r3, n3 + 1);
          }, body = function(e4, t4, r3) {
            r3.push(e4 + ":");
            if (t4 && t4.reference) {
              r3.push("  Reference: " + value(t4.reference));
              return;
            }
            if (!t4 || t4.available !== true) {
              r3.push("  Available: false");
              r3.push("  Reason: " + value(t4 && t4.reason));
              if (t4 && t4.bytes !== void 0) r3.push("  Bytes: " + value(t4.bytes));
              if (t4 && t4.structure) structure("Structure", t4.structure, r3, 1);
              return;
            }
            r3.push("  Available: true");
            r3.push("  Encoding: " + value(t4.encoding));
            r3.push("  Bytes: " + value(t4.bytes));
            if (Object.prototype.hasOwnProperty.call(t4, "data")) {
              var n3 = t4.encoding === "base64" ? "BASE64" : "UTF-8 TEXT";
              r3.push("  ----- BEGIN " + n3 + " -----");
              r3.push(String(t4.data));
              r3.push("  ----- END " + n3 + " -----");
            }
          }, exchange = function(e4, t4, r3) {
            if (!t4) {
              r3.push(e4 + ": unavailable");
              return;
            }
            r3.push(e4 + ":");
            var n3 = ["url", "method", "status", "synthetic", "changed", "transportHeadersRecomputedByLoon"];
            for (var a3 = 0; a3 < n3.length; a3++) if (Object.prototype.hasOwnProperty.call(t4, n3[a3])) r3.push("  " + n3[a3] + ": " + value(t4[n3[a3]]));
            if (Object.prototype.hasOwnProperty.call(t4, "headers")) structure("headers", t4.headers, r3, 1);
            if (Object.prototype.hasOwnProperty.call(t4, "h2_trailers")) structure("h2_trailers", t4.h2_trailers, r3, 1);
            if (Object.prototype.hasOwnProperty.call(t4, "body")) body("  body", t4.body, r3);
          }, eventText = function(e4, t4, r3, n3) {
            var a3 = ["", "================================================================================", "EVENT " + (e4 + 1) + " | " + value(t4.endpoint) + " | " + value(t4.phase) + " | " + String(t4.level).toUpperCase(), "================================================================================", "Time: " + shanghaiTime(t4.time), "Level: " + String(t4.level).toUpperCase(), "Source: " + t4.source, "Version: " + t4.version, "Endpoint: " + t4.endpoint, "Phase: " + value(t4.phase), "Summary: " + t4.message];
            if (t4.timing) structure("Capture-Timing-Ms", t4.timing, a3, 0);
            if (n3) a3.push("Capture-Error: " + n3);
            if (!r3) {
              a3.push("Capture: unavailable");
              return a3.join("\n") + "\n";
            }
            a3.push("Runtime: " + value(r3.runtime));
            structure("Correlation", r3.correlation, a3, 0);
            structure("Processing", r3.processing, a3, 0);
            if (r3.qualityResearch) structure("Quality-Research", r3.qualityResearch, a3, 0);
            exchange("Request-Inner-Before", r3.requestInner, a3);
            exchange("Request-Inner-After", r3.requestInnerAfter, a3);
            exchange("Request-Before", r3.request, a3);
            exchange("Request-After", r3.requestAfter, a3);
            exchange("Response-Before", r3.responseBefore, a3);
            exchange("Response-After", r3.responseAfter, a3);
            return a3.join("\n") + "\n";
          }, eventGap = function(e4, t4) {
            if (t4 === 0) return "unavailable";
            var r3 = Date.parse(e4[t4].time), n3 = Date.parse(e4[t4 - 1].time);
            return Number.isFinite(r3) && Number.isFinite(n3) && r3 >= n3 ? r3 - n3 : "unavailable";
          };
          if (e3) {
            if (e3.preventDefault) e3.preventDefault();
            var a2 = await fetch("/pause", { method: "POST", cache: "no-store" });
            if (!a2.ok) throw new Error("Pause failed, check that Loon is running.");
            var i2 = document.getElementById("recording-state"), o3 = document.getElementById("start-recording"), s3 = document.getElementById("pause-recording");
            if (i2) {
              i2.textContent = "Paused";
              i2.className = "status";
            }
            if (o3) o3.disabled = false;
            if (s3) s3.disabled = true;
            ["mark-ad", "mark-content", "mark-quality-auto", "mark-quality-highest"].forEach(function(e4) {
              var t4 = document.getElementById(e4);
              if (t4) t4.disabled = true;
            });
            var u3 = document.getElementById("mark-note");
            if (u3) u3.textContent = "Once recording starts you can mark ads or main content.";
          }
          t3.textContent = "Generating the log file, keep Loon running\u2026";
          async function get(e4) {
            var t4 = await fetch(e4, { cache: "no-store" });
            if (!t4.ok) throw new Error("Local read failed (" + t4.status + "), pause recording and export again.");
            return await t4.json();
          }
          var l3 = await get("/export-manifest.json");
          var f2 = l3.rows, c2 = l3.data, d2 = [], p2 = [];
          d2.push(["YouTube full diagnostic log", "Format-Version: 4", "Time-Zone: Asia/Shanghai (UTC+08:00)", "Exported-Time: " + shanghaiTime(c2.exportedAt), "Session: " + value(c2.session), "Recording: " + (c2.recording ? "on" : "paused"), "Stopped-Reason: " + value(c2.stoppedReason), "Entries: " + f2.length, "Recorded-Endpoints: " + c2.coverage.summary, "Playback-Initialization-Observed: " + c2.coverage.hasPlaybackInitialization, "Initialization-Versions: " + c2.coverage.initializationVersions.join(","), "Structure-Capture-Enabled: " + value(c2.settings.rawCapture), "Media-Capture-Mode-At-Export: " + value(c2.settings.mediaCaptureMode), "Quality-Research-At-Export: " + value(c2.settings.qualityResearch), "Summary-Minimum-Level: " + value(c2.settings.summaryMinimumLevel), "Capture-Budget-MB: " + value(c2.settings.budgetMB), "Scope: browse, refresh/config, player, initplayback, ad-break, Shorts and UMP media events matched by the plugin", "Body-Storage: redacted protocol structure only", "Privacy: credentials, raw bodies, config keys, media content and unknown values are removed before storage; quality research retains only whitelisted format metadata, not signed query values", "Completeness: best-effort Loon script capture; see LIMITATIONS at end", ""].join("\n"));
          d2.push("\nEvent timeline / TIMELINE\nNote: \u0394  is the interval since the previous event, not the request duration; the number matches the EVENT below.\nNo. | Shanghai time | Level | API | Phase | \u0394(ms) | Summary\n");
          for (var g2 = 0; g2 < f2.length; g2++) {
            var y2 = f2[g2];
            d2.push([g2 + 1, shanghaiTime(y2.time), String(y2.level).toUpperCase(), value(y2.endpoint), value(y2.phase), eventGap(f2, g2), value(y2.message)].join(" | ") + "\n");
          }
          d2.push("\nEvent details / DETAILS\n");
          for (var v2 = 0; v2 < f2.length; v2++) {
            var h2 = f2[v2], m2 = null, b2 = h2.captureError || null;
            t3.textContent = "Reading records " + (v2 + 1) + " / " + f2.length;
            if (h2.captureRef) {
              var w2 = h2.captureRef, x = [];
              for (var S = 0; S < w2.chunks; S++) {
                var k = await get("/export-chunk/" + l3.session + "/" + v2 + "/" + S);
                if (typeof k.chunk !== "string") throw new Error("Local sample chunk invalid, export again.");
                x.push(k.chunk);
              }
              var A = x.join("");
              if (A.length !== w2.chars || checksum(A) !== w2.checksum) throw new Error("Sample verification failed, keep existing records and check storage.");
              m2 = JSON.parse(A);
              if (m2.schema !== 1 || m2.source !== h2.source || m2.time !== h2.time || m2.phase !== h2.phase) throw new Error("Sample metadata mismatch, export again.");
            } else if (b2) p2.push(shanghaiTime(h2.time) + " " + h2.source + " " + b2);
            d2.push(eventText(v2, h2, m2, b2));
          }
          d2.push("\n================================================================================\nLIMITATIONS\n================================================================================\n");
          for (var _ = 0; _ < c2.completeness.limitations.length; _++) d2.push(_ + 1 + ". " + c2.completeness.limitations[_] + "\n");
          d2.push("All-Referenced-Samples-Readable: " + (p2.length === 0) + "\n");
          for (_ = 0; _ < p2.length; _++) d2.push("Issue: " + p2[_] + "\n");
          var O = new Blob(d2, { type: "text/plain;charset=utf-8" });
          if (r2.href && r2.href.indexOf("blob:") === 0) URL.revokeObjectURL(r2.href);
          r2.href = URL.createObjectURL(O);
          r2.download = "YouTube-" + shanghaiTime(c2.exportedAt).replace(/[:.]/g, "-") + ".log";
          r2.hidden = false;
          t3.textContent = "Log file generated (" + f2.length + "  records), downloading; if Safari shows no download prompt, tap Save log file.";
          r2.click();
        } catch (E) {
          t3.textContent = E.message || "Export failed, check that Loon is running.";
          r2.hidden = true;
        } finally {
          if (n2) n2.disabled = false;
        }
      }
      function exportRows(e3) {
        return records(e3);
      }
      function coverage(e3) {
        var t3 = ["browse", "next", "search", "config", "log_event", "initplayback", "player", "get_watch", "ad_break", "reel_watch_sequence", "ump"];
        var r2 = {}, n2 = [], a2 = [], i2 = false;
        for (var o3 = 0; o3 < t3.length; o3++) r2[t3[o3]] = 0;
        for (o3 = 0; o3 < e3.length; o3++) {
          var s3 = e3[o3];
          if (!Object.prototype.hasOwnProperty.call(r2, s3.endpoint)) continue;
          r2[s3.endpoint]++;
          if (/^(initplayback|player|get_watch)$/.test(s3.endpoint)) {
            i2 = true;
            if (s3.endpoint === "initplayback" && s3.phase === "response" && s3.source === "YouTubeLogger") continue;
            if (/^\d+\.\d+\.\d+$/.test(s3.version) && n2.indexOf(s3.version) < 0) n2.push(s3.version);
          }
        }
        for (o3 = 0; o3 < t3.length; o3++) a2.push(t3[o3] + "=" + r2[t3[o3]]);
        return { counts: r2, summary: a2.join(" / "), hasPlaybackInitialization: i2, initializationVersions: n2 };
      }
      function page(e3, t3) {
        function escape(e4) {
          return String(e4).replace(/[&<>"']/g, function(e5) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[e5];
          });
        }
        function time(e4) {
          var t4 = Date.parse(e4), r3 = new Date(t4 + 8 * 36e5);
          return Number.isFinite(t4) && Number.isFinite(r3.getTime()) ? r3.toISOString().slice(5, 23).replace("T", " ") : "Unknown time";
        }
        var r2 = !!(e3 && e3.enabled === true), n2 = !!(e3 && e3.haltReason), a2 = 0, i2 = 0;
        var o3 = [16, 32, 64].indexOf(Number(y.capture_budget)) >= 0 ? Number(y.capture_budget) : 32;
        var s3 = { "user mark: ad-playing": "Marked: ad playing", "user mark: content-playing": "Marked: main content playing", "user mark: quality-auto-selected": "Marked: switched to auto quality", "user mark: quality-highest-manually-selected": "Marked: highest quality selected manually" };
        var u3 = { YouTubeFeed: "Feed", YouTubePlayback: "Player", YouTubeConfig: "Config", YouTubeLogger: "Logging tool" };
        for (var l3 = 0; l3 < t3.length; l3++) {
          if (t3[l3].level === "error") a2++;
          if (Object.prototype.hasOwnProperty.call(s3, t3[l3].message)) i2++;
        }
        var f2 = t3.slice(-20).reverse().map(function(e4) {
          var t4 = Object.prototype.hasOwnProperty.call(s3, e4.message), r3 = t4 ? s3[e4.message] : e4.message;
          var n3 = e4.phase === "request" ? "Request" : e4.phase === "response" ? "Response" : "Summary";
          return '<article class="record"><div class="record-head"><time datetime="' + escape(e4.time) + '">' + escape(time(e4.time)) + '</time><span class="result ' + (e4.level === "error" ? "error" : e4.level === "warn" ? "warn" : "") + '">' + escape(e4.level.toUpperCase()) + '</span></div><p class="endpoint">' + (t4 ? "Manual marker" : escape(e4.endpoint)) + '</p><p class="record-message">' + escape(r3) + '</p><div class="record-meta"><span>' + escape(u3[e4.source] || "History") + "</span><span>" + n3 + "</span>" + (e4.captureRef ? "<span>with redacted structures</span>" : "") + "</div></article>";
        }).join("");
        var d2 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="#f03"/><rect x="38" y="66" width="180" height="124" rx="34" fill="#fff"/><path d="M110 98l51 30-51 30z" fill="#f03"/></svg>';
        var p2 = ':root{color-scheme:light dark;--bg:#f6f7fb;--panel:#fff;--text:#202532;--muted:#6d7485;--line:#e8ebf1;--accent:#ce1738;--soft:#fff0f2;--green:#138356;--danger:#bd3045;--amber:#99600b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:760px;margin:0 auto;padding:24px 18px 40px;padding-bottom:calc(40px + env(safe-area-inset-bottom))}.brand-icon{width:48px;height:48px;flex:none}.brand-icon svg{display:block;width:100%;height:100%}.heading{display:flex;align-items:center;gap:12px}header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 22px}h1{font-size:24px;letter-spacing:-.5px;margin:0}.eyebrow{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:2px;margin:0 0 5px}.status{font-size:12px;white-space:nowrap;border-radius:24px;padding:6px 12px;background:var(--line);color:var(--muted)}.status.on{background:#e5f5ed;color:var(--green)}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px}.stat,.panel{background:var(--panel);border:1px solid var(--line);border-radius:18px}.stat{padding:16px 12px}.stat strong{display:block;font-size:27px;line-height:1.2}.stat span{display:block;margin-top:7px;color:var(--muted);font-size:12px}.panel{padding:18px;margin-top:16px}h2{font-size:17px;margin:0 0 12px}.section-title{display:flex;justify-content:space-between;align-items:center;gap:8px}.section-title small{font-size:12px;color:var(--muted);font-weight:400}p{margin:8px 0;color:var(--muted)}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}a,button{-webkit-tap-highlight-color:transparent;display:block;width:100%;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);font:inherit;font-weight:600;text-decoration:none;text-align:center;padding:12px;min-height:48px;cursor:pointer}.primary{background:var(--accent);color:white;border-color:var(--accent)}form{margin:0}.clear{color:var(--danger);background:var(--soft);border-color:transparent}.clear-form{grid-column:1/-1}.note{font-size:13px;margin-top:14px}.settings{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:14px;color:var(--muted);font-size:12px}.notice{padding:12px 16px;background:var(--soft);color:var(--danger);border-radius:12px;margin-bottom:16px;font-size:13px}.empty{text-align:center;padding:18px 10px}.empty strong{display:block;margin-bottom:8px}.record{border-top:1px solid var(--line);padding:14px 0}.record:last-child{padding-bottom:0}.record-head,.record-meta{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:12px}.result{color:var(--accent)}.result.error{color:var(--danger)}.result.warn{color:var(--amber)}.endpoint{color:var(--text);font:13px/1.6 ui-monospace,monospace;overflow-wrap:anywhere;margin:9px 0 4px}.record-message{font-size:13px;overflow-wrap:anywhere;margin:4px 0 9px}.record-meta{justify-content:flex-start;flex-wrap:wrap;gap:8px 16px}details{color:var(--muted);font-size:13px}details+details{border-top:1px solid var(--line);margin-top:14px;padding-top:14px}summary{cursor:pointer;color:var(--text);font-weight:600}footer{font-size:12px;color:var(--muted);text-align:center;margin-top:22px}button:disabled{opacity:.45;cursor:default}button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}[hidden]{display:none!important}#status{font-size:13px;overflow-wrap:anywhere}#status:empty{display:none}#save{margin-top:10px}.quality-actions{margin-top:10px}@media(prefers-color-scheme:dark){:root{--bg:#14151b;--panel:#20222c;--text:#f1f2f7;--muted:#a4aabd;--line:#343744;--soft:#35232a;--accent:#ff6e87;--danger:#ff9ba9;--amber:#f0c16f}.status.on{background:#18372d;color:#8de0b8}.primary{color:#29141a}}@media(max-width:360px){main{padding:16px 12px}h1{font-size:21px}.stat{padding:14px 9px}.panel{padding:14px}.actions button,.actions a{padding:11px 8px;font-size:14px}}';
        return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>YouTube Log</title><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,' + encodeURIComponent(d2) + '"><style>' + p2 + '</style></head><body><main><header><div class="heading"><div class="brand-icon" aria-hidden="true">' + d2 + '</div><div><p class="eyebrow">YOUTUBE</p><h1>Dev log</h1></div></div><span id="recording-state" class="status' + (r2 ? " on" : "") + '">' + (r2 ? "\u25CF Recording" : n2 ? "Stopped" : "Paused") + "</span></header>" + (n2 ? '<div class="notice" role="status">Recording stopped due to capacity or storage issues. Download the log first, then clear and retry.</div>' : "") + '<section class="stats" aria-label="Log stats"><div class="stat"><strong>' + t3.length + '</strong><span>Saved records</span></div><div class="stat"><strong>' + a2 + '</strong><span>Error records</span></div><div class="stat"><strong>' + i2 + '</strong><span>Manual marker</span></div></section><section class="panel"><h2>Record management</h2><div class="actions"><button class="primary" id="download" type="button">Download log</button><a href="/">Refresh records</a><form method="post" action="/start"><button id="start-recording" type="submit"' + (r2 ? " disabled" : "") + '>Start recording</button></form><form method="post" action="/pause"><button id="pause-recording" type="submit"' + (!r2 ? " disabled" : "") + '>Pause recording</button></form><form class="clear-form" method="post" action="/clear"><button class="clear" type="submit">Clear log and pause</button></form></div><p id="status" role="status" aria-live="polite"></p><a id="save" hidden>Save log file</a><div class="settings"><span>Log level ' + escape(h.toUpperCase()) + "</span><span>Media " + (y.media_capture_mode === "full" ? "Full sampling" : "Headers only") + "</span><span>Capacity " + o3 + ' MB</span></div><p class="note">Downloading pauses automatically and generates a .log file on this page. Starting recording keeps existing logs; clearing cannot be undone.</p>' + (typeof $loon === "string" ? '<p class="note">After turning off the logging tool in the main plugin, the next API hit clears the log automatically. Download first if you need to keep it.</p>' : "") + '</section><section class="panel"><h2>Playback markers</h2><div class="actions"><form method="post" action="/mark-ad"><button id="mark-ad" type="submit"' + (!r2 ? " disabled" : "") + '>Ad playing</button></form><form method="post" action="/mark-content"><button id="mark-content" type="submit"' + (!r2 ? " disabled" : "") + ">Main content playing</button></form></div>" + (typeof $loon === "string" && devFlag(y.quality_research) ? '<div class="actions quality-actions"><form method="post" action="/mark-quality-auto"><button id="mark-quality-auto" type="submit"' + (!r2 ? " disabled" : "") + '>Switched to auto quality</button></form><form method="post" action="/mark-quality-highest"><button id="mark-quality-highest" type="submit"' + (!r2 ? " disabled" : "") + ">Highest quality selected</button></form></div>" : "") + '<p class="note" id="mark-note">' + (r2 ? "Tap to mark the current playback state, to locate issues in the log." : "Once recording starts you can mark ads or main content.") + '</p></section><section class="panel"><h2 class="section-title">Recent records <small>showing at most 20</small></h2>' + (f2 || '<div class="empty"><strong>No records yet</strong><p>' + (r2 ? "Open YouTube and refresh the Home feed or play a video, then come back and refresh." : "Tap Start recording, reproduce the issue in YouTube, then come back and refresh.") + "</p></div>") + '</section><section class="panel"><details><summary>Sampling settings and log level</summary><p>Dev capture: ' + (devFlag(y.capture_raw) ? "on, redacted structures saved" : "off, summary only") + ". By default only media response headers are recorded, without waiting for the body; full sampling is for development analysis and may add playback delay.</p><p>Select the log level in the main plugin: info keeps the full redacted trace; error keeps errors only; debug keeps full records and debug level; warn keeps warnings and errors. Level changes only affect new records.</p><p>The shared index holds at most 600 entries or 128 KiB, redacted samples are stored up to the selected capacity. Recording stops at the limit and keeps existing data, download before clearing.</p><p>Pause only stops log writes; turning off the logging tool in Loon also disables media sampling, or switch back to headers to stop buffering media bodies. Pausing from the Stash page also disables media sampling.</p>" + (typeof $loon === "string" && devFlag(y.quality_research) ? "<p>Quality research sampling is on. Candidate SABR fields do not reflect the actual rendered quality, compare menu choices with what the device shows; small media POST requests will have their body read. Turn the research switch off when done.</p>" : "") + "</details><details><summary>Privacy and scope</summary><p>Records are stored on this device only. Safe transport headers, redacted protocol structures, ad markers and processing results are saved; tokens, cookies, account identifiers, keys and media bodies are removed before writing.</p><p>Only requests actually matched by the script are recorded, not all network traffic. Proxy connection, certificate and script timeout records cannot be read, and concurrent writes may lose some events.</p><p>After downloading you can save it in Safari, or use the Share menu to store it in \u201CFiles\u201D.</p></details></section><footer>Shanghai time \xB7 Asia/Shanghai \xB7 UTC+08:00 \xB7 millisecond precision<br>YouTube Log " + c + '</footer></main><script>document.getElementById("download").onclick=' + browserExport.toString() + ";<\/script></body></html>";
      }
      function run() {
        if (y.log_enabled !== true && y.log_enabled !== "true") {
          if (typeof e2 !== "undefined") {
            if (/^http:\/\/youtube-logs\.invalid(?::80)?(?:\/|$)/.test(e2.url || "")) return response(403, "Turn on the logging tool manually in the main plugin first.", "text/plain; charset=utf-8");
            return {};
          }
          return { title: "YouTube Log", content: "Turn on the logging tool manually in the main plugin first." };
        }
        if (typeof e2 !== "undefined") {
          var n2 = p.exec(e2.url || "");
          var i2 = g.exec(e2.url || "");
          if (n2 || i2) {
            var s3 = n2 ? n2[1].toLowerCase() : i2[1].toLowerCase();
            var u3 = /^(browse|next|search)$/i.test(s3) ? "YouTubeFeed" : /^(log_event|config|initplayback)$/i.test(s3) ? "YouTubeConfig" : n2 || s3 === "videoplayback" ? "YouTubePlayback" : "YouTubeLogger";
            var v2 = s3 === "reel/reel_watch_sequence" ? "reel_watch_sequence" : s3 === "videoplayback" ? "ump" : s3;
            var h2 = typeof $loon === "string" && devFlag(y.quality_research) && !!i2 && s3 === "videoplayback" && String(e2.method || "GET").toUpperCase() === "POST" && typeof r === "undefined";
            var b2 = !h2 && (typeof r === "undefined" || !!i2 && y.media_capture_mode !== "full");
            if (i2) m.push((s3 === "initplayback" ? "initialization_response" : "media") + (b2 ? ": headers_only=true body_buffering=false" : h2 ? ": quality_request=true body_buffering=true" : ": development_response=true body_buffering=true"));
            if (i2 && s3 === "initplayback" && typeof r !== "undefined") u3 = "YouTubeLogger";
            devCapture(u3, typeof r !== "undefined" ? "response" : "request", v2, c, {}, b2);
            return {};
          }
        }
        if (typeof e2 === "undefined") {
          if (typeof $notification !== "undefined") $notification.post("YouTube Log", "Tap to open the log page", "Start, pause or download the .log file", { openUrl: f });
          return { title: "YouTube Log", content: "Open in browser " + f + ", tap Start recording, reproduce the issue and download the log." };
        }
        var w2 = /^http:\/\/youtube-logs\.invalid(?::80)?(\/[^?#]*)?(?:\?[^#]*)?$/.exec(e2.url || "");
        if (!w2) return {};
        var x = w2[1] || "/";
        var S = String(e2.method || "GET").toUpperCase();
        if (S !== "GET" && S !== "POST") return response(405, "Method not allowed", "text/plain; charset=utf-8", { Allow: "GET, POST" });
        if (S === "POST") {
          var k = e2.headers || {}, A = Object.keys(k);
          for (var _ = 0; _ < A.length; _++) {
            var O = A[_].toLowerCase(), E = String(k[A[_]]);
            if (O === "origin" && E !== "http://youtube-logs.invalid" && E !== "http://youtube-logs.invalid:80" || O === "sec-fetch-site" && E.toLowerCase() === "cross-site") return response(403, "Foreign origin rejected", "text/plain; charset=utf-8");
          }
        }
        var C = x === "/clear" ? null : config();
        if (x === "/start" || x === "/pause" || x === "/clear" || x === "/mark-ad" || x === "/mark-content" || x === "/mark-quality-auto" || x === "/mark-quality-highest") {
          if (S !== "POST") return response(405, "Use the buttons on the log page.", "text/plain; charset=utf-8", { Allow: "POST" });
          if (x === "/mark-ad" || x === "/mark-content" || x === "/mark-quality-auto" || x === "/mark-quality-highest") {
            if (/^\/mark-quality-/.test(x) && !(typeof $loon === "string" && devFlag(y.quality_research))) return response(403, "Enable quality research sampling in the Loon main plugin first.", "text/plain; charset=utf-8");
            if (!C || C.enabled !== true) return response(409, "Start recording before marking the playback state.", "text/plain; charset=utf-8");
            if (!devAppend({ source: "YouTubeLogger", version: c, endpoint: "unknown", time: (/* @__PURE__ */ new Date()).toISOString(), level: "info", message: "user mark: " + (x === "/mark-ad" ? "ad-playing" : x === "/mark-content" ? "content-playing" : x === "/mark-quality-auto" ? "quality-auto-selected" : "quality-highest-manually-selected") }, null)) return response(507, "Marker not saved, export the records first and check why recording stopped.", "text/plain; charset=utf-8");
            return response(303, "", "text/plain; charset=utf-8", { Location: f });
          }
          if (x === "/clear") {
            C = { enabled: false, session: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12) };
            write(C, t2);
            var T = null;
            try {
              T = read(o2);
            } catch (e3) {
            }
            if (T && Array.isArray(T.entries)) T.entries.slice(0, d).forEach(function(e3) {
              var t3 = e3 && e3.captureRef;
              if (!t3 || typeof t3.prefix !== "string" || !/^ytads\.capture\.[a-z0-9-]+\.[a-z0-9-]+\.$/.test(t3.prefix) || !Number.isInteger(t3.chunks) || t3.chunks < 1 || t3.chunks > 256) return;
              for (var r2 = 0; r2 < t3.chunks; r2++) if (a.write(void 0, t3.prefix + r2) !== true) throw new Error("clear-chunk-failed");
            });
            write({ session: C.session, entries: [], captureBytes: 0 }, o2);
            l2.forEach(function(e3) {
              if (a.write(void 0, "ytads.logger." + e3 + ".v1") !== true) throw new Error("clear-legacy-failed");
            });
          } else {
            if (!C) C = { session: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12) };
            C.enabled = x === "/start";
            if (C.enabled) {
              delete C.haltReason;
              delete C.haltedAt;
            }
            shared(C);
            write(C, t2);
          }
          return response(303, "", "text/plain; charset=utf-8", { Location: f });
        }
        if (S !== "GET") return response(405, "Method not allowed", "text/plain; charset=utf-8", { Allow: "GET" });
        if (x === "/export") return exportPage();
        if (x === "/export-manifest.json") {
          if (C && C.enabled) return response(409, "Pause recording on the log page first, then export.", "text/plain; charset=utf-8");
          var $ = exportRows(C);
          var R = developmentExport(C, []);
          R.coverage = coverage($);
          return response(200, JSON.stringify({ session: C && C.session || "none", rows: $, data: R }), "application/json; charset=utf-8");
        }
        var N = /^\/export-chunk\/([a-z0-9-]{1,80})\/(\d{1,3})\/(\d{1,3})$/.exec(x);
        if (N) {
          if (!C || C.enabled || C.session !== N[1]) return response(409, "Recording state changed, pause and export again.", "text/plain; charset=utf-8");
          var B = Number(N[2]), q = Number(N[3]);
          var j = exportRows(C);
          var z = j[B] && j[B].captureRef;
          if (!z || q >= z.chunks) return response(404, "Sample not found", "text/plain; charset=utf-8");
          var I = a.read(z.prefix + q);
          if (typeof I !== "string" || I.length > 131072) return response(503, "Sample chunk missing or corrupted, no truncated file generated.", "text/plain; charset=utf-8");
          return response(200, JSON.stringify({ chunk: I }), "application/json; charset=utf-8");
        }
        if (x !== "/" && x !== "/download.log") return response(404, "Not found", "text/plain; charset=utf-8");
        var L = records(C);
        if (x === "/") return response(200, page(C, L), "text/html; charset=utf-8", { "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" });
        return response(303, "", "text/plain; charset=utf-8", { Location: f + "export" });
      }
      var w;
      try {
        w = run();
      } catch (t3) {
        if (typeof e2 !== "undefined" && /^http:\/\/youtube-logs\.invalid(?::80)?(?:\/|$)/.test(e2.url || "")) {
          w = response(503, "Log storage unavailable, check whether the script is updated or look for storage errors in the Loon log.", "text/plain; charset=utf-8");
        } else w = { title: "YouTube Log", content: "The log entry point cannot be opened, check the script." };
      }
      i(w);
    })();
  }, e);
}
export {
  YouTubeLogger
};
