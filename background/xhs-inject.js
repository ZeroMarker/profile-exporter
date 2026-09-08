// Xiaohongshu API interceptor - injected into page context
// Intercepts API responses so the extension can access data
(function () {
  "use strict";

  const XHS_API_PREFIX = "/api/sns/web/v1/";
  const interceptedResponses = {};
  const CACHE_TTL = 30000;
  const MAX_CACHED = 50;

  function pruneCache() {
    const now = Date.now();
    const keys = Object.keys(interceptedResponses);
    for (const key of keys) {
      if (now - interceptedResponses[key].ts >= CACHE_TTL) delete interceptedResponses[key];
    }
    const overflow = Object.keys(interceptedResponses).length - MAX_CACHED;
    for (let i = 0; i < overflow; i++) delete interceptedResponses[Object.keys(interceptedResponses)[i]];
  }

  function storeResponse(key, data) {
    pruneCache();
    interceptedResponses[key] = { data, ts: Date.now() };
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
      if (this._url && this._url.includes(XHS_API_PREFIX)) {
        try {
          const data = JSON.parse(this.responseText);
          storeResponse(this._url, data);
          window.postMessage(
            { type: "__xhs_api_response__", url: this._url, data },
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
    if (url.includes(XHS_API_PREFIX)) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        storeResponse(url, data);
        window.postMessage(
          { type: "__xhs_api_response__", url, data },
          "*"
        );
      } catch {}
    }
    return response;
  };

  // Listen for API call requests from content script
  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.type !== "__xhs_api_request__") return;

    const { id, path } = event.data;
    if (typeof path !== "string" || !path.startsWith(XHS_API_PREFIX)) return;
    const fullUrl = `https://edith.xiaohongshu.com${path}`;

    // Check cache first (valid for 30 seconds)
    const cached = interceptedResponses[path] || interceptedResponses[fullUrl];
    if (cached) {
      if (Date.now() - cached.ts < CACHE_TTL) {
        window.postMessage(
          { type: "__xhs_api_response__", id, data: cached.data },
          "*"
        );
        return;
      }
      delete interceptedResponses[path];
      delete interceptedResponses[fullUrl];
    }

    try {
      // Try to use the page's signature function
      if (typeof window._webmsxyw === "function") {
        const [signHeaders] = window._webmsxyw(path, undefined);
        const resp = await origFetch(fullUrl, {
          credentials: "include",
          headers: {
            ...signHeaders,
            "Content-Type": "application/json",
            Referer: "https://www.xiaohongshu.com/",
            Origin: "https://www.xiaohongshu.com",
          },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        storeResponse(path, data);
        window.postMessage({ type: "__xhs_api_response__", id, data }, "*");
      } else {
        window.postMessage(
          { type: "__xhs_api_response__", id, error: "Signature function not available. Please refresh the page." },
          "*"
        );
      }
    } catch (err) {
      window.postMessage(
        { type: "__xhs_api_response__", id, error: err.message },
        "*"
      );
    }
  });
})();
