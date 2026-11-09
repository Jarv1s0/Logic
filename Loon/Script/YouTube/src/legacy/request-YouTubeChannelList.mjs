// devchristian1337; extracted from the previously vendored bundle. See SOURCE.md.
import { ytRuntimeInvoke } from "../legacy-runtime.mjs";
function YouTubeChannelList(e, t) {
  return ytRuntimeInvoke(function(e2, t2, r, n, a) {
    (function() {
      "use strict";
      var i = "ytads.channels.remote.v1";
      var o = typeof r === "object" && r ? r : {};
      var s = false, u = null;
      function finish(e3) {
        if (s) return;
        s = true;
        if (u !== null && typeof clearTimeout === "function") clearTimeout(u);
        console.log("[YouTubeChannelList] " + e3);
        a({ title: "YouTube UP Main list", content: e3 });
      }
      if (typeof $loon !== "string" || typeof e2 !== "undefined" || typeof t2 !== "undefined") return a({});
      var l = typeof o.blocked_channels_url === "string" ? o.blocked_channels_url.trim() : "";
      if (!l) return finish("Remote list not enabled; the manual list is unaffected.");
      if (l.length > 2048 || !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?::443)?\/[^\s?#<>]*$/i.test(l)) return finish("Invalid URL: enter a public HTTPS plain-text direct link.");
      if (typeof n === "undefined" || typeof $httpClient === "undefined" || typeof $httpClient.get !== "function") return finish("The list cannot be updated in this environment; the existing cache is kept.");
      function size(e3) {
        var t3 = 0;
        for (var r2 = 0; r2 < e3.length; r2++) {
          var n2 = e3.charCodeAt(r2);
          if (n2 < 128) t3++;
          else if (n2 < 2048) t3 += 2;
          else if (n2 >= 55296 && n2 <= 56319) {
            var a2 = e3.charCodeAt(++r2);
            if (!(a2 >= 56320 && a2 <= 57343)) throw Error("invalid-utf8");
            t3 += 4;
          } else if (n2 >= 56320 && n2 <= 57343) throw Error("invalid-utf8");
          else t3 += 3;
        }
        return t3;
      }
      function list(e3) {
        if (typeof e3 !== "string" || e3.length > 65536 || size(e3) > 65536 || /[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(e3)) throw Error("invalid-list");
        var t3 = e3.replace(/^\uFEFF/, "").split(/\r?\n/).filter(function(e4) {
          return !/^\s*#/.test(e4);
        }).join(" ").trim();
        if (!t3) return "";
        var r2 = t3.split(/\s+/), n2 = /* @__PURE__ */ Object.create(null), a2 = [];
        if (r2.length > 256) throw Error("list-limit");
        for (var i2 = 0; i2 < r2.length; i2++) {
          var o2 = r2[i2];
          if (o2.length > 160 || /[{},;="'`\\]/.test(o2)) throw Error("invalid-list");
          if (/^(?:[a-z]+:|\/)/i.test(o2) && !/^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:channel\/UC[\w-]{22}|@[^/?#\s]+)\/?$/i.test(o2) && !/^\/(?:channel\/UC[\w-]{22}|@[^/?#\s]+)\/?$/.test(o2)) throw Error("invalid-list");
          if (!n2[o2]) {
            n2[o2] = true;
            a2.push(o2);
          }
        }
        t3 = a2.join(" ");
        if (t3.length > 8192 || size(t3) > 8192) throw Error("list-limit");
        return t3;
      }
      if (typeof setTimeout === "function") u = setTimeout(function() {
        finish("Update timed out; the existing cache for this URL is kept.");
      }, 6e3);
      try {
        $httpClient.get({ url: l, timeout: 5e3, headers: { Accept: "text/plain" }, "auto-cookie": false, "auto-redirect": false, insecure: false }, function(e3, t3, r2) {
          if (s) return;
          if (e3 || !t3 || Number(t3.status) !== 200) return finish("Download failed; the existing cache for this URL is kept.");
          try {
            var a2 = "", o2 = t3.headers || {};
            Object.keys(o2).forEach(function(e4) {
              if (e4.toLowerCase() === "content-type") a2 = String(o2[e4]).split(";")[0].trim().toLowerCase();
            });
            if (a2 && a2 !== "text/plain" && a2 !== "application/octet-stream") throw Error("invalid-type");
            var u2 = list(r2), f = u2 ? u2.split(" ").length : 0;
            if (n.write(JSON.stringify({ schema: 1, url: l, text: u2, fetchedAt: Date.now() }), i) !== true) throw Error("store-failed");
            finish("Remote list updated: " + f + " entries. Refresh the YouTube feed again.");
          } catch (e4) {
            finish("Invalid list format or save failed; the existing cache for this URL is kept.");
          }
        });
      } catch (e3) {
        finish("Download failed; the existing cache for this URL is kept.");
      }
    })();
  }, e);
}
export {
  YouTubeChannelList
};
