const PlatformTikTok = {
  name: "tiktok",
  categories: ["following", "likes", "favorites"],

  async fetch(category, { maxItems = 1000 } = {}) {
    const cookies = await getCookieForDomain(".tiktok.com");
    const msToken = cookies.find((c) => c.name === "msToken")?.value || "";

    const headers = {
      "Referer": "https://www.tiktok.com/",
      "Accept": "application/json, text/plain, */*",
    };

    switch (category) {
      case "following":
        return this.fetchFollowing(headers, msToken, { maxItems });
      case "likes":
        return this.fetchLikes(headers, msToken, { maxItems });
      case "favorites":
        return this.fetchFavorites(headers, msToken, { maxItems });
      default:
        return [];
    }
  },

  async fetchFollowing(headers, msToken, { maxItems }) {
    const userInfo = await this.getUserInfo(headers);
    if (!userInfo) throw new Error("Cannot determine user info. Make sure you are logged in to TikTok.");

    return fetchAllPages(
      async ({ cursor }) => {
        let url = `https://www.tiktok.com/api/friend/friend_list/?user_id=${userInfo.userId}&count=30&max_followers=10000`;
        if (cursor) url += `&cursor=${cursor}`;
        if (msToken) url += `&msToken=${msToken}`;

        const data = await fetchWithCookies(url, { headers });
        return {
          items: (data.user_list || []).map((u) => ({
            id: String(u.user?.uid || ""),
            username: u.user?.unique_id || "",
            name: u.user?.nickname || "",
            url: `https://www.tiktok.com/@${u.user?.unique_id || ""}`,
            avatar_url: u.user?.avatar_thumb?.url_list?.[0] || "",
          })),
          nextCursor: data.has_more ? String(data.cursor) : null,
          total: data.total,
        };
      },
      { maxItems }
    );
  },

  async fetchLikes(headers, msToken, { maxItems }) {
    const userInfo = await this.getUserInfo(headers);
    if (!userInfo) throw new Error("Cannot determine user info.");

    return fetchAllPages(
      async ({ cursor }) => {
        let url = `https://www.tiktok.com/api/video/list/?user_id=${userInfo.userId}&count=30`;
        if (cursor) url += `&max_cursor=${cursor}`;
        if (msToken) url += `&msToken=${msToken}`;

        const data = await fetchWithCookies(url, { headers });
        return {
          items: (data.item_list || []).map((v) => ({
            id: String(v.id || ""),
            username: v.author?.unique_id || "",
            name: v.author?.nickname || "",
            url: `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.id}`,
            avatar_url: v.author?.avatar_thumb?.url_list?.[0] || "",
          })),
          nextCursor: data.has_more ? String(data.max_cursor) : null,
        };
      },
      { maxItems }
    );
  },

  async fetchFavorites(headers, msToken, { maxItems }) {
    const userInfo = await this.getUserInfo(headers);
    if (!userInfo) throw new Error("Cannot determine user info.");

    return fetchAllPages(
      async ({ cursor }) => {
        let url = `https://www.tiktok.com/api/favorite/video/list/?user_id=${userInfo.userId}&count=30`;
        if (cursor) url += `&max_cursor=${cursor}`;
        if (msToken) url += `&msToken=${msToken}`;

        const data = await fetchWithCookies(url, { headers });
        return {
          items: (data.item_list || []).map((v) => ({
            id: String(v.id || ""),
            username: v.author?.unique_id || "",
            name: v.author?.nickname || "",
            url: `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.id}`,
            avatar_url: v.author?.avatar_thumb?.url_list?.[0] || "",
          })),
          nextCursor: data.has_more ? String(data.max_cursor) : null,
        };
      },
      { maxItems }
    );
  },

  async getUserInfo(headers) {
    try {
      const data = await fetchWithCookies("https://www.tiktok.com/api/user/info/?aid=1988", { headers });
      const user = data?.userInfo?.user;
      if (user) return { userId: user.uid, uniqueId: user.unique_id };
      return null;
    } catch {
      return null;
    }
  },
};

if (typeof module !== "undefined") {
  module.exports = { PlatformTikTok };
}
