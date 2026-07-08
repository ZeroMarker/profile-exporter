// Content script for Xiaohongshu - bridges page context and extension
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "xhs_api") return;

  const requestId = `xhs_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const listener = (event) => {
    if (event.data?.type !== "__xhs_api_response__" || event.data?.id !== requestId) return;
    window.removeEventListener("message", listener);
    if (event.data.error) {
      sendResponse({ error: event.data.error });
    } else {
      sendResponse({ data: event.data.data });
    }
  };

  window.addEventListener("message", listener);
  window.postMessage({ type: "__xhs_api_request__", id: requestId, path: msg.path }, "*");

  setTimeout(() => {
    window.removeEventListener("message", listener);
    sendResponse({ error: "Request timed out. Make sure you are on xiaohongshu.com." });
  }, 15000);

  return true; // keep channel open for async response
});

// Inject the API interceptor script into page context
try {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("background/xhs-inject.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
} catch {}
