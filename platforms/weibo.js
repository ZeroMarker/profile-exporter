const PlatformWeibo = {
  name: "weibo",
  categories: ["following", "likes", "favorites"],

  async fetch(category, { maxItems = 1000 } = {}) {
    const cookies = await getCookieForDomain(".weibo.com");
    const xsrf = cookies.find((c) => c.name === "XSRF-TOKEN")?.value || "";

    const headers = {
      "Referer": "https://weibo.com/",
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN": xsrf,
    };

    switch (category) {
      case "following":
        return this.fetchFollowing(headers, { maxItems });
      case "likes":
        return this.fetchLikes(headers, { maxItems });
      case "favorites":
        return this.fetchFavorites(headers, { maxItems });
      default:
        return [];
    }
  },

  async fetchFollowing(headers, { maxItems }) {
    const uid = await this.getUid(headers);
    if (!uid) throw new Error("Cannot determine user ID. Make sure you are logged in to Weibo.");

    return fetchAllPages(
      async ({ page = 1 }) => {
        const url = `https://weibo.com/ajax/friendships/friends?uid=${uid}&page=${page}`;
        const data = await fetchWithCookies(url, { headers });
        const users = data?.data?.users || [];
        return {
          items: users.map((u) => ({
            id: String(u.id),
            username: u.screen_name,
            name: u.screen_name,
            url: `https://weibo.com/u/${u.id}`,
            avatar_url: u.profile_image_url || "",
          })),
          nextCursor: users.length > 0 ? page + 1 : null,
          total: data?.data?.total_number,
        };
      },
      { maxItems }
    );
  },

  async fetchLikes(headers, { maxItems }) {
    const uid = await this.getUid(headers);
    if (!uid) throw new Error("Cannot determine user ID.");

    return fetchAllPages(
      async ({ page = 1 }) => {
        const url = `https://weibo.com/ajax/profile/likes?uid=${uid}&page=${page}`;
        const data = await fetchWithCookies(url, { headers });
        const list = data?.data?.list || [];
        return {
          items: list.map((item) => ({
            id: String(item.id || item.mid),
            username: item.user?.screen_name || "",
            name: item.text_raw || item.text || "",
            url: `https://weibo.com/${item.user?.id}/${item.mblogid || item.id}`,
            avatar_url: item.user?.profile_image_url || "",
          })),
          nextCursor: list.length > 0 ? page + 1 : null,
        };
      },
      { maxItems }
    );
  },

  async fetchFavorites(headers, { maxItems }) {
    return fetchAllPages(
      async ({ page = 1 }) => {
        const url = `https://weibo.com/ajax/profile/favorites?page=${page}`;
        const data = await fetchWithCookies(url, { headers });
        const list = data?.data?.list || [];
        return {
          items: list.map((item) => ({
            id: String(item.id || item.mid),
            username: item.user?.screen_name || "",
            name: item.text_raw || item.text || "",
            url: `https://weibo.com/${item.user?.id}/${item.mblogid || item.id}`,
            avatar_url: item.user?.profile_image_url || "",
          })),
          nextCursor: list.length > 0 ? page + 1 : null,
        };
      },
      { maxItems }
    );
  },

  async getUid(headers) {
    try {
      const data = await fetchWithCookies("https://weibo.com/ajax/profile/info", { headers });
      return data?.data?.user?.id || null;
    } catch {
      return null;
    }
  },
};

if (typeof module !== "undefined") {
  module.exports = { PlatformWeibo };
}
