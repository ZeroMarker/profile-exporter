// Douyin API interceptor - injected into page context
(function () {
  "use strict";

  const API_PREFIXES = ["/aweme/v1/web/", "/tiktok/v1/web/", "/api/", "/web/api/"];
  const interceptedResponses = {};

  function isDouyinApi(url) {
    return API_PREFIXES.some((p) => url.includes(p));
  }

  // Intercept XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      if (this._url && isDouyinApi(this._url)) {
        try {
          const data = JSON.parse(this.responseText);
          interceptedResponses[this._url] = { data, ts: Date.now() };
          window.postMessage(
            { type: "__douyin_api_response__", url: this._url, data },
            "*"
          );
        } catch {}
      }
    });
    return origSend.apply(this, arguments);
  };

  // Intercept fetch
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const response = await origFetch.apply(this, arguments);
    if (isDouyinApi(url)) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        interceptedResponses[url] = { data, ts: Date.now() };
        window.postMessage(
          { type: "__douyin_api_response__", url, data },
          "*"
        );
      } catch {}
    }
    return response;
  };

  // Listen for API call requests from content script
  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.type !== "__douyin_api_request__") return;

    const { id, url } = event.data;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== "https://www.douyin.com" || !parsed.pathname.startsWith("/aweme/v1/web/")) return;
    } catch { return; }

    // Check cache first (valid for 30 seconds)
    const cached = interceptedResponses[url];
    if (cached && Date.now() - cached.ts < 30000) {
      window.postMessage(
        { type: "__douyin_api_response__", id, data: cached.data },
        "*"
      );
      return;
    }

    try {
      const resp = await origFetch(url, {
        credentials: "include",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://www.douyin.com/",
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      interceptedResponses[url] = { data, ts: Date.now() };
      window.postMessage({ type: "__douyin_api_response__", id, data }, "*");
    } catch (err) {
      window.postMessage(
        { type: "__douyin_api_response__", id, error: err.message },
        "*"
      );
    }
  });

  // Listen for UID extraction requests
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.type !== "__douyin_get_uid__") return;

    try {
      // Try to extract from RENDER_DATA script tag
      const scripts = document.querySelectorAll("script#RENDER_DATA");
      for (const script of scripts) {
        const decoded = decodeURIComponent(script.textContent);
        const match = decoded.match(/"uid"\s*:\s*"(\d+)"/);
        if (match) {
          window.postMessage(
            { type: "__douyin_uid_result__", uid: match[1] },
            "*"
          );
          return;
        }
      }

      // Try to extract from URL
      const pathMatch = window.location.pathname.match(/\/user\/(\d+)/);
      if (pathMatch) {
        window.postMessage(
          { type: "__douyin_uid_result__", uid: pathMatch[1] },
          "*"
        );
        return;
      }

      window.postMessage({ type: "__douyin_uid_result__", uid: null }, "*");
    } catch {
      window.postMessage({ type: "__douyin_uid_result__", uid: null }, "*");
    }
  });
})();
