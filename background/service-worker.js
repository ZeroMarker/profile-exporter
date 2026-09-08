importScripts("../utils/api.js", "../utils/export.js", "../platforms/x.js", "../platforms/instagram.js", "../platforms/tiktok.js", "../platforms/bilibili.js", "../platforms/youtube.js", "../platforms/weibo.js", "../platforms/xiaohongshu.js", "../platforms/douyin.js");

const platformModules = {
  x: PlatformX,
  instagram: PlatformInstagram,
  tiktok: PlatformTikTok,
  bilibili: PlatformBilibili,
  youtube: PlatformYouTube,
  weibo: PlatformWeibo,
  xiaohongshu: PlatformXiaohongshu,
  douyin: PlatformDouyin,
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

  if (!Array.isArray(categories) || categories.length === 0 ||
      categories.some((category) => !mod.categories.includes(category))) {
    throw new Error("Select valid categories for this platform.");
  }
  if (!["json", "csv"].includes(format)) throw new Error("Invalid export format.");
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 10000) {
    throw new Error("Max items must be an integer from 1 to 10000.");
  }
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

    await exportData(data, format);
    total += items.length;
  }

  return { success: true, count: total };
}
