// Content script for Douyin - bridges page context and extension
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "douyin_api") {
    const requestId = `dy_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const listener = (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type !== "__douyin_api_response__" || event.data?.id !== requestId) return;
      window.removeEventListener("message", listener);
      clearTimeout(timer);
      if (event.data.error) {
        sendResponse({ error: event.data.error });
      } else {
        sendResponse({ data: event.data.data });
      }
    };

    window.addEventListener("message", listener);
    window.postMessage({ type: "__douyin_api_request__", id: requestId, url: msg.url }, window.location.origin);

    const timer = setTimeout(() => {
      window.removeEventListener("message", listener);
      sendResponse({ error: "Request timed out. Make sure you are on douyin.com." });
    }, 15000);

    return true;
  }

  if (msg.action === "douyin_get_uid") {
    const listener = (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type !== "__douyin_uid_result__") return;
      window.removeEventListener("message", listener);
      clearTimeout(timer);
      sendResponse({ uid: event.data.uid });
    };

    window.addEventListener("message", listener);
    window.postMessage({ type: "__douyin_get_uid__" }, window.location.origin);

    const timer = setTimeout(() => {
      window.removeEventListener("message", listener);
      sendResponse({ uid: null });
    }, 5000);

    return true;
  }
});

// Inject the API interceptor script into page context
try {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("background/douyin-inject.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
} catch {}
