const PlatformXiaohongshu = {
  name: "xiaohongshu",
  categories: ["following", "likes", "collections"],

  async fetch(category, { maxItems = 1000 } = {}) {
    switch (category) {
      case "following":
        return this.fetchFollowing({ maxItems });
      case "likes":
        return this.fetchLikes({ maxItems });
      case "collections":
        return this.fetchCollections({ maxItems });
      default:
        return [];
    }
  },

  async fetchFollowing({ maxItems }) {
    const userId = await this.getUserId();
    if (!userId) {
      throw new Error("Cannot determine user ID. Make sure you are logged in to Xiaohongshu and have visited your profile page.");
    }

    return fetchAllPages(
      async ({ cursor }) => {
        const params = new URLSearchParams({ user_id: userId, num: "30" });
        if (cursor) params.set("cursor", cursor);

        const data = await this.callApi(`/api/sns/web/v1/user/follows?${params}`);
        if (!data) return { items: [], nextCursor: null };

        const list = data.data?.users || [];
        return {
          items: list.map((u) => ({
            id: u.user_id || "",
            username: u.nickname || "",
            name: u.nickname || "",
            url: `https://www.xiaohongshu.com/user/profile/${u.user_id}`,
            avatar_url: u.imageb || u.images || "",
          })),
          nextCursor: data.data?.has_more ? data.data?.cursor : null,
        };
      },
      { maxItems }
    );
  },

  async fetchLikes({ maxItems }) {
    const userId = await this.getUserId();
    if (!userId) throw new Error("Cannot determine user ID. Make sure you have visited your profile page.");

    return fetchAllPages(
      async ({ cursor }) => {
        const params = new URLSearchParams({ user_id: userId, num: "30" });
        if (cursor) params.set("cursor", cursor);

        const data = await this.callApi(`/api/sns/web/v1/user/otherposts?${params}`);
        if (!data) return { items: [], nextCursor: null };

        const notes = data.data?.notes || [];
        return {
          items: notes.map((n) => ({
            id: n.note_id || "",
            username: n.user?.nickname || "",
            name: n.display_title || "",
            url: `https://www.xiaohongshu.com/explore/${n.note_id}`,
            avatar_url: n.cover?.url || "",
          })),
          nextCursor: data.data?.has_more ? data.data?.cursor : null,
        };
      },
      { maxItems }
    );
  },

  async fetchCollections({ maxItems }) {
    const userId = await this.getUserId();
    if (!userId) throw new Error("Cannot determine user ID. Make sure you have visited your profile page.");

    return fetchAllPages(
      async ({ cursor }) => {
        const params = new URLSearchParams({ user_id: userId, num: "30" });
        if (cursor) params.set("cursor", cursor);

        const data = await this.callApi(`/api/sns/web/v1/user/collected?${params}`);
        if (!data) return { items: [], nextCursor: null };

        const notes = data.data?.notes || [];
        return {
          items: notes.map((n) => ({
            id: n.note_id || "",
            username: n.user?.nickname || "",
            name: n.display_title || "",
            url: `https://www.xiaohongshu.com/explore/${n.note_id}`,
            avatar_url: n.cover?.url || "",
          })),
          nextCursor: data.data?.has_more ? data.data?.cursor : null,
        };
      },
      { maxItems }
    );
  },

  async callApi(path) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "xhs_api",
        path,
      });
      if (response?.error) {
        console.error("XHS API error:", response.error);
        return null;
      }
      return response?.data || null;
    } catch (err) {
      console.error("XHS message error:", err);
      return null;
    }
  },

  async getUserId() {
    try {
      const cookies = await getCookieForDomain(".xiaohongshu.com");
      const webSession = cookies.find((c) => c.name === "web_session");
      if (webSession) {
        const parts = webSession.value.split("_");
        if (parts.length > 0) return parts[0];
      }
      const webId = cookies.find((c) => c.name === "webId");
      if (webId) return webId.value;
    } catch {}
    return null;
  },
};

if (typeof module !== "undefined") {
  module.exports = { PlatformXiaohongshu };
}
