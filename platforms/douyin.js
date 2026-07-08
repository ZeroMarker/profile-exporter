const PlatformDouyin = {
  name: "douyin",
  categories: ["following", "likes", "favorites"],

  async fetch(category, { maxItems = 1000 } = {}) {
    switch (category) {
      case "following":
        return this.fetchFollowing({ maxItems });
      case "likes":
        return this.fetchLikes({ maxItems });
      case "favorites":
        return this.fetchFavorites({ maxItems });
      default:
        return [];
    }
  },

  async fetchFollowing({ maxItems }) {
    const userId = await this.getUserId();
    if (!userId) throw new Error("Cannot determine user ID. Make sure you are logged in to Douyin and have visited your profile page.");

    return fetchAllPages(
      async ({ cursor = 0 }) => {
        const data = await this.callApi(
          `https://www.douyin.com/aweme/v1/web/user/following/list/?device_platform=webapp&aid=6383&user_id=${userId}&cursor=${cursor}&count=20`
        );
        if (!data) return { items: [], nextCursor: null };

        const list = data.following_list || [];
        return {
          items: list.map((u) => ({
            id: String(u.uid || ""),
            username: u.unique_id || u.short_id || "",
            name: u.nickname || "",
            url: `https://www.douyin.com/user/${u.sec_uid || ""}`,
            avatar_url: u.avatar_thumb?.url_list?.[0] || "",
          })),
          nextCursor: data.has_more ? String(data.cursor) : null,
        };
      },
      { maxItems }
    );
  },

  async fetchLikes({ maxItems }) {
    const userId = await this.getUserId();
    if (!userId) throw new Error("Cannot determine user ID. Make sure you have visited your profile page.");

    return fetchAllPages(
      async ({ cursor = 0 }) => {
        const data = await this.callApi(
          `https://www.douyin.com/aweme/v1/web/aweme/favorite/?device_platform=webapp&aid=6383&user_id=${userId}&cursor=${cursor}&count=20`
        );
        if (!data) return { items: [], nextCursor: null };

        const list = data.aweme_list || [];
        return {
          items: list.map((v) => ({
            id: String(v.aweme_id || ""),
            username: v.author?.unique_id || "",
            name: v.desc || "",
            url: `https://www.douyin.com/video/${v.aweme_id}`,
            avatar_url: v.author?.avatar_thumb?.url_list?.[0] || "",
          })),
          nextCursor: data.has_more ? String(data.cursor) : null,
        };
      },
      { maxItems }
    );
  },

  async fetchFavorites({ maxItems }) {
    const userId = await this.getUserId();
    if (!userId) throw new Error("Cannot determine user ID. Make sure you have visited your profile page.");

    return fetchAllPages(
      async ({ cursor = 0 }) => {
        const data = await this.callApi(
          `https://www.douyin.com/aweme/v1/web/aweme/favorite/?device_platform=webapp&aid=6383&user_id=${userId}&cursor=${cursor}&count=20&sort_type=2`
        );
        if (!data) return { items: [], nextCursor: null };

        const list = data.aweme_list || [];
        return {
          items: list.map((v) => ({
            id: String(v.aweme_id || ""),
            username: v.author?.unique_id || "",
            name: v.desc || "",
            url: `https://www.douyin.com/video/${v.aweme_id}`,
            avatar_url: v.author?.avatar_thumb?.url_list?.[0] || "",
          })),
          nextCursor: data.has_more ? String(data.cursor) : null,
        };
      },
      { maxItems }
    );
  },

  async callApi(url) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "douyin_api",
        url,
      });
      if (response?.error) {
        console.error("Douyin API error:", response.error);
        return null;
      }
      return response?.data || null;
    } catch (err) {
      console.error("Douyin message error:", err);
      return null;
    }
  },

  async getUserId() {
    try {
      const cookies = await getCookieForDomain(".douyin.com");
      const uidCookie = cookies.find((c) => c.name === "uid_tt" || c.name === "passport_csrf_token");
      if (uidCookie) return uidCookie.value;

      // Try to extract from page RENDER_DATA
      const response = await chrome.runtime.sendMessage({ action: "douyin_get_uid" });
      return response?.uid || null;
    } catch {
      return null;
    }
  },
};

if (typeof module !== "undefined") {
  module.exports = { PlatformDouyin };
}
