const PlatformX = {
  name: "x",
  categories: ["following", "likes", "bookmarks"],

  async fetch(category, { maxItems = 1000 } = {}) {
    const cookies = await getCookieForDomain(".x.com");
    const csrf = getCSRFCookie(cookies);
    const bearer = extractBearerToken();

    const baseHeaders = {
      authorization: `Bearer ${bearer}`,
      "x-csrf-token": csrf || "",
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
    };

    switch (category) {
      case "following":
        return this.fetchFollowing(baseHeaders, { maxItems });
      case "likes":
        return this.fetchLikes(baseHeaders, { maxItems });
      case "bookmarks":
        return this.fetchBookmarks(baseHeaders, { maxItems });
      default:
        return [];
    }
  },

  async fetchFollowing(headers, { maxItems }) {
    const userId = await this.getUserId(headers);
    if (!userId) throw new Error("Cannot determine user ID. Make sure you are logged in to X.");

    return fetchAllPages(
      async ({ cursor }) => {
        let url = `https://api.x.com/1.1/friends/list.json?user_id=${userId}&count=200`;
        if (cursor) url += `&cursor=${cursor}`;

        const data = await fetchWithCookies(url, { headers });
        return {
          items: (data.users || []).map((u) => ({
            id: String(u.id_str),
            username: u.screen_name,
            name: u.name,
            url: `https://x.com/${u.screen_name}`,
            avatar_url: u.profile_image_url_https?.replace("_normal", "_400x400"),
          })),
          nextCursor: data.next_cursor_str !== "0" ? data.next_cursor_str : null,
          total: data.total_count,
        };
      },
      { maxItems }
    );
  },

  async fetchLikes(headers, { maxItems }) {
    const userId = await this.getUserId(headers);
    if (!userId) throw new Error("Cannot determine user ID.");

    return fetchAllPages(
      async ({ cursor }) => {
        let url = `https://api.x.com/1.1/favorites/list.json?user_id=${userId}&count=200`;
        if (cursor) url += `&max_id=${cursor}`;

        const data = await fetchWithCookies(url, { headers });
        return {
          items: (data || []).map((t) => ({
            id: String(t.id_str),
            username: t.user.screen_name,
            name: t.user.name,
            url: `https://x.com/${t.user.screen_name}/status/${t.id_str}`,
            avatar_url: t.user.profile_image_url_https?.replace("_normal", "_400x400"),
          })),
          nextCursor: data.length === 200 ? String(BigInt(data[data.length - 1].id_str) - 1n) : null,
        };
      },
      { maxItems }
    );
  },

  async fetchBookmarks(headers, { maxItems }) {
    const userId = await this.getUserId(headers);
    if (!userId) throw new Error("Cannot determine user ID.");

    return fetchAllPages(
      async ({ cursor }) => {
        const variables = JSON.stringify({ count: 50, userId });
        const features = JSON.stringify({
          rweb_tipjar_consumption_enabled: true,
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          creator_subscriptions_tweet_preview_api_enabled: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          communities_web_enable_tweet_community_results_fetch: true,
          c9s_tweet_anatomy_moderator_badge_enabled: true,
          articles_preview_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          view_counts_everywhere_api_enabled: true,
          longform_notetweets_consumption_enabled: true,
          responsive_web_twitter_article_tweet_consumption_enabled: true,
          tweet_awards_web_tipping_enabled: false,
          creator_subscriptions_quote_tweet_preview_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: true,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
          rweb_video_timestamps_enabled: true,
          longform_notetweets_rich_text_read_enabled: true,
          longform_notetweets_inline_media_enabled: true,
          responsive_web_enhance_cards_enabled: false,
        });

        let url = `https://x.com/i/api/graphql/gkjsKepM6gl_HmFWoWKfgg/Bookmarks?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;
        if (cursor) {
          const vars = JSON.parse(variables);
          vars.cursor = cursor;
          url = `https://x.com/i/api/graphql/gkjsKepM6gl_HmFWoWKfgg/Bookmarks?variables=${encodeURIComponent(JSON.stringify(vars))}&features=${encodeURIComponent(features)}`;
        }

        const data = await fetchWithCookies(url, { headers });
        const instructions = data?.data?.bookmark_timeline_?.timeline_?.instructions || [];
        const entries = instructions.find((i) => i.type === "TimelineAddEntries")?.entries || [];

        const items = [];
        let nextCursor = null;

        for (const entry of entries) {
          if (entry.entryId?.startsWith("cursor-bottom")) {
            nextCursor = entry.content?.value || null;
            continue;
          }
          const tweet = entry.content?.itemContent?.tweet_results?.result;
          if (!tweet) continue;
          const user = tweet.core?.user_results?.result?.legacy;
          if (!user) continue;

          items.push({
            id: tweet.rest_id,
            username: user.screen_name,
            name: user.name,
            url: `https://x.com/${user.screen_name}/status/${tweet.rest_id}`,
            avatar_url: user.profile_image_url_https?.replace("_normal", "_400x400"),
          });
        }

        return { items, nextCursor, total: items.length };
      },
      { maxItems }
    );
  },

  async getUserId(headers) {
    try {
      const data = await fetchWithCookies("https://api.x.com/1.1/account/verify_credentials.json", { headers });
      return data?.id_str || null;
    } catch {
      return null;
    }
  },
};

if (typeof module !== "undefined") {
  module.exports = { PlatformX };
}
