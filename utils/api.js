const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function getCSRFCookie(cookies) {
  const csrf = cookies.find(
    (c) => c.name === "ct0" || c.name === "csrf_token" || c.name === "bili_jct" || c.name === "XSRF-TOKEN"
  );
  return csrf ? csrf.value : null;
}

async function getCookieForDomain(domain) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain }, resolve);
  });
}

async function fetchWithCookies(url, options = {}) {
  const { method = "GET", headers = {}, body = null, retries = 3 } = options;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const fetchOptions = {
        method,
        credentials: "include",
        headers: { ...DEFAULT_HEADERS, ...headers },
      };
      if (body) fetchOptions.body = body;

      const response = await fetch(url, fetchOptions);
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

async function fetchAllPages(fetchPage, { maxItems = 1000, onProgress } = {}) {
  const allItems = [];
  let cursor = null;
  let page = 0;

  while (allItems.length < maxItems) {
    page++;
    const result = await fetchPage({ cursor, page });
    if (!result || !result.items || result.items.length === 0) break;

    allItems.push(...result.items);
    cursor = result.nextCursor;

    if (onProgress) onProgress({ fetched: allItems.length, total: result.total });
    if (!cursor) break;
  }

  return allItems.slice(0, maxItems);
}

function extractBearerToken() {
  return "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
}

if (typeof module !== "undefined") {
  module.exports = {
    fetchWithCookies,
    fetchAllPages,
    getCSRFCookie,
    getCookieForDomain,
    extractBearerToken,
    DEFAULT_HEADERS,
  };
}
