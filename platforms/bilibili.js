const PlatformBilibili = {
  name: "bilibili",
  categories: ["following", "favorites"],

  async fetch(category, { maxItems = 1000 } = {}) {
    const cookies = await getCookieForDomain(".bilibili.com");
    const csrf = cookies.find((c) => c.name === "bili_jct")?.value || "";

    const headers = {
      "Referer": "https://www.bilibili.com/",
      "Origin": "https://www.bilibili.com",
    };

    switch (category) {
      case "following":
        return this.fetchFollowing(headers, csrf, { maxItems });
      case "favorites":
        return this.fetchFavorites(headers, csrf, { maxItems });
      default:
        return [];
    }
  },

  async fetchFollowing(headers, csrf, { maxItems }) {
    const mid = await this.getMid(headers);
    if (!mid) throw new Error("Cannot determine user ID. Make sure you are logged in to Bilibili.");

    return fetchAllPages(
      async ({ page = 1 }) => {
        const url = `https://api.bilibili.com/x/relation/followings?vmid=${mid}&pn=${page}&ps=50&order=desc`;
        const data = await fetchWithCookies(url, { headers });
        if (data.code !== 0) throw new Error(data.message || "API error");

        const list = data.data?.list || [];
        return {
          items: list.map((u) => ({
            id: String(u.mid),
            username: u.uname,
            name: u.uname,
            url: `https://space.bilibili.com/${u.mid}`,
            avatar_url: u.face,
          })),
          nextCursor: list.length === 50 ? page + 1 : null,
          total: data.data?.total,
        };
      },
      { maxItems }
    );
  },

  async fetchFavorites(headers, csrf, { maxItems }) {
    const mid = await this.getMid(headers);
    if (!mid) throw new Error("Cannot determine user ID.");

    // First, get list of favorite folders
    const folderRes = await fetchWithCookies(
      `https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${mid}`,
      { headers }
    );
    if (folderRes.code !== 0) throw new Error(folderRes.message || "Cannot list favorites");

    const folders = folderRes.data?.list || [];
    if (folders.length === 0) return [];

    const allItems = [];

    for (const folder of folders) {
      if (allItems.length >= maxItems) break;

      const remaining = maxItems - allItems.length;
      const folderItems = await fetchAllPages(
        async ({ page = 1 }) => {
          const url = `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${folder.id}&pn=${page}&ps=20&order=mtime`;
          const data = await fetchWithCookies(url, { headers });
          if (data.code !== 0) return { items: [], nextCursor: null };

          const medias = data.data?.medias || [];
          return {
            items: medias.map((m) => ({
              id: String(m.id),
              username: m.upper?.name || "",
              name: m.title || "",
              url: m.uri || `https://www.bilibili.com/video/${m.bvid}`,
              avatar_url: m.cover || "",
            })),
            nextCursor: data.data?.has_more ? page + 1 : null,
            total: data.data?.page?.count,
          };
        },
        { maxItems: remaining }
      );

      allItems.push(...folderItems);
    }

    return allItems;
  },

  async getMid(headers) {
    try {
      const data = await fetchWithCookies("https://api.bilibili.com/x/web-interface/nav", { headers });
      return data?.data?.mid || null;
    } catch {
      return null;
    }
  },
};

if (typeof module !== "undefined") {
  module.exports = { PlatformBilibili };
}
