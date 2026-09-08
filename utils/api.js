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

  if (!Number.isInteger(retries) || retries < 1) throw new Error("Invalid retry count");

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
        if (attempt === retries - 1) throw new Error("Rate limit exceeded (HTTP 429). Please try again later.");
        const value = response.headers.get("Retry-After");
        const seconds = value && /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - Date.now()) / 1000;
        const delay = Number.isFinite(seconds) ? Math.max(0, seconds) : 5;
        await new Promise((r) => setTimeout(r, Math.min(delay, 60) * 1000));
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
  let cursor;
  const seenCursors = new Set();
  const seenIds = new Set();
  let page = 0;

  while (allItems.length < maxItems) {
    page++;
    const result = await fetchPage({ cursor, page });
    if (!result || !Array.isArray(result.items)) throw new Error("Invalid pagination response");
    if (result.items.length === 0) break;

    for (const item of result.items) {
      const id = item.id == null || item.id === "" ? null : String(item.id);
      if (id !== null && seenIds.has(id)) continue;
      if (id !== null) seenIds.add(id);
      allItems.push(item);
    }
    cursor = result.nextCursor;

    if (onProgress) onProgress({ fetched: allItems.length, total: result.total });
    if (cursor == null || cursor === "" || allItems.length >= maxItems) break;
    if (seenCursors.has(String(cursor))) throw new Error("Pagination cursor repeated; export may be incomplete.");
    seenCursors.add(String(cursor));
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

async function sendToPlatformTab(host, message) {
  const tabs = await chrome.tabs.query({ url: `https://${host}/*` });
  const tab = tabs.find((candidate) => candidate.active) || tabs[0];
  if (!tab) throw new Error(`Open ${host}, log in and visit your profile before exporting.`);
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    throw new Error(`Cannot reach ${host}. Refresh the page and try again.`);
  }
  if (!response) throw new Error(`No response from ${host}. Refresh the page and try again.`);
  if (response.error) throw new Error(response.error);
  return response;
}
