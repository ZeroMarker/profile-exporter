importScripts("../utils/api.js", "../utils/export.js", "../platforms/x.js", "../platforms/instagram.js", "../platforms/tiktok.js", "../platforms/bilibili.js", "../platforms/youtube.js");

const platformModules = {
  x: PlatformX,
  instagram: PlatformInstagram,
  tiktok: PlatformTikTok,
  bilibili: PlatformBilibili,
  youtube: PlatformYouTube,
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "export") {
    handleExport(msg)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keeps the message channel open for async response
  }
});

async function handleExport({ platform, categories, format, maxItems }) {
  const mod = platformModules[platform];
  if (!mod) throw new Error(`Unknown platform: ${platform}`);

  let total = 0;

  for (const category of categories) {
    if (!mod.categories.includes(category)) continue;

    const items = await mod.fetch(category, { maxItems });
    if (items.length === 0) continue;

    const data = {
      platform,
      category,
      exported_at: new Date().toISOString(),
      count: items.length,
      items,
    };

    exportData(data, format);
    total += items.length;
  }

  return { success: true, count: total };
}
