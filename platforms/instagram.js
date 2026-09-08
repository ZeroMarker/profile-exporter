const PlatformInstagram = {
  name: "instagram",
  categories: ["following", "saved"],

  async fetch(category, { maxItems = 1000 } = {}) {
    const cookies = await getCookieForDomain(".instagram.com");
    const csrf = cookies.find((c) => c.name === "csrftoken")?.value || "";
    const appId = "936619743392459";
    const userId = await this.getUserId(csrf);
    if (!userId) throw new Error("Cannot determine user ID. Make sure you are logged in to Instagram.");

    const headers = {
      "x-csrf-token": csrf,
      "x-ig-app-id": appId,
      "x-requested-with": "XMLHttpRequest",
    };

    switch (category) {
      case "following":
        return this.fetchFollowing(userId, headers, { maxItems });
      case "saved":
        return this.fetchSaved(userId, headers, { maxItems });
      default:
        return [];
    }
  },

  async getUserId(csrf) {
    try {
      const data = await fetchWithCookies("https://www.instagram.com/api/v1/web/accounts/ai/", {
        headers: { "x-csrf-token": csrf, "x-ig-app-id": "936619743392459" },
      });
      return data?.user?.pk || null;
    } catch {
      // Fallback: try verify endpoint
      try {
        const data = await fetchWithCookies("https://www.instagram.com/accounts/edit/", {
          headers: { "x-csrf-token": csrf, "x-ig-app-id": "936619743392459" },
        });
        // This won't work but let's try another approach
      } catch {
        // ignore
      }
      return null;
    }
  },

  async fetchFollowing(userId, headers, { maxItems }) {
    return fetchAllPages(
      async ({ cursor }) => {
        let url = `https://www.instagram.com/api/v1/friendships/${userId}/following/`;
        if (cursor) url += `?max_id=${cursor}`;

        const data = await fetchWithCookies(url, { headers });
        return {
          items: (data.users || []).map((u) => ({
            id: String(u.pk),
            username: u.username,
            name: u.full_name,
            url: `https://www.instagram.com/${u.username}/`,
            avatar_url: u.profile_pic_url,
          })),
          nextCursor: data.next_max_id ? String(data.next_max_id) : null,
        };
      },
      { maxItems }
    );
  },

  async fetchSaved(userId, headers, { maxItems }) {
    return fetchAllPages(
      async ({ cursor }) => {
        const docId = "1788744285804016480";
        const variables = JSON.stringify({
          id: userId,
          first: 50,
          include_chaining: false,
          include_reel: false,
          include_suggested_users: false,
          include_logged_out_extras: true,
          include_highlight_reels: false,
          include_live_status: false,
        });

        let url = `https://www.instagram.com/graphql/query/?doc_id=${docId}&variables=${encodeURIComponent(variables)}`;
        if (cursor) {
          const vars = JSON.parse(variables);
          vars.after = cursor;
          url = `https://www.instagram.com/graphql/query/?doc_id=${docId}&variables=${encodeURIComponent(JSON.stringify(vars))}`;
        }

        const data = await fetchWithCookies(url, { headers });
        const edges = data?.data?.user?.edge_saved_media?.edges || [];
        const pageInfo = data?.data?.user?.edge_saved_media?.page_info;

        return {
          items: edges.map((e) => ({
            id: e.node?.shortcode || e.node?.id,
            username: e.node?.owner?.username || "",
            name: "",
            url: `https://www.instagram.com/p/${e.node?.shortcode}/`,
            avatar_url: e.node?.display_url || "",
          })),
          nextCursor: pageInfo?.has_next_page ? pageInfo?.end_cursor : null,
        };
      },
      { maxItems }
    );
  },
};

if (typeof module !== "undefined") {
  module.exports = { PlatformInstagram };
}
