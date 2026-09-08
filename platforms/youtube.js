const PlatformYouTube = {
  name: "youtube",
  categories: ["subscriptions", "watchlater"],

  async fetch(category, { maxItems = 1000 } = {}) {
    switch (category) {
      case "subscriptions":
        return this.fetchSubscriptions({ maxItems });
      case "watchlater":
        return this.fetchWatchLater({ maxItems });
      default:
        return [];
    }
  },

  async fetchSubscriptions({ maxItems }) {
    // YouTube subscriptions are available via /feed/channels
    // The page contains serialized data we can extract
    return fetchAllPages(
      async ({ cursor }) => {
        let url = "https://www.youtube.com/feed/channels";
        if (cursor) url += `?flow=grid&sort_by=DATE_ADDED&view=0&continuation=${cursor}`;

        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) throw new Error(`YouTube HTTP ${response.status}`);
        const html = await response.text();

        // Extract initial data from page source
        const match = html.match(/var ytInitialData = ({.+?});<\/script>/);
        if (!match) {
          // Try alternative extraction
          const altMatch = html.match(/window\["ytInitialData"\]\s*=\s*({.+?});/);
          if (!altMatch) throw new Error("YouTube page data unavailable. Check login and page format.");
          return this.parseSubscriptionsData(altMatch[1]);
        }
        return this.parseSubscriptionsData(match[1]);
      },
      { maxItems }
    );
  },

  parseSubscriptionsData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      const tab = tabs.find((t) => t.tabRenderer?.selected) || tabs.find((t) => t.tabRenderer?.content);
      const items =
        tab?.tabRenderer?.content?.richGridRenderer?.contents ||
        tab?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]
          ?.shelfRenderer?.content?.expandedShelfContentsRenderer?.items ||
        [];

      const channels = [];
      let nextCursor = null;

      for (const item of items) {
        const channel = item.richItemRenderer?.content?.channelRenderer || item.channelRenderer;
        if (channel) {
          channels.push({
            id: channel.channelId,
            username: channel.title?.runs?.[0]?.text || "",
            name: channel.title?.runs?.[0]?.text || "",
            url: `https://www.youtube.com/channel/${channel.channelId}`,
            avatar_url: channel.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || "",
          });
        }
        // Check for continuation token
        const cont = (item.continuationItemRenderer || item.richItemRenderer?.content?.continuationItemRenderer)?.continuationEndpoint?.continuationCommand?.token;
        if (cont) nextCursor = cont;
      }

      return { items: channels, nextCursor };
    } catch (err) {
      throw new Error(`Cannot parse YouTube data: ${err.message}`);
    }
  },

  async fetchWatchLater({ maxItems }) {
    return fetchAllPages(
      async ({ cursor }) => {
        let url = "https://www.youtube.com/playlist?list=WL";
        if (cursor) url += `&continuation=${cursor}`;

        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) throw new Error(`YouTube HTTP ${response.status}`);
        const html = await response.text();

        const match = html.match(/var ytInitialData = ({.+?});<\/script>/);
        if (!match) {
          const altMatch = html.match(/window\["ytInitialData"\]\s*=\s*({.+?});/);
          if (!altMatch) throw new Error("YouTube page data unavailable. Check login and page format.");
          return this.parsePlaylistData(altMatch[1]);
        }
        return this.parsePlaylistData(match[1]);
      },
      { maxItems }
    );
  },

  parsePlaylistData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const contents =
        data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents ||
        data?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems ||
        [];

      const videos = [];
      let nextCursor = null;

      for (const item of contents) {
        const video = item.playlistVideoRenderer;
        if (video) {
          videos.push({
            id: video.videoId,
            username: video.shortBylineText?.runs?.[0]?.text || "",
            name: video.title?.runs?.[0]?.text || video.title || "",
            url: `https://www.youtube.com/watch?v=${video.videoId}`,
            avatar_url: video.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || "",
          });
        }
        const cont = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
        if (cont) nextCursor = cont;
      }

      return { items: videos, nextCursor };
    } catch (err) {
      throw new Error(`Cannot parse YouTube data: ${err.message}`);
    }
  },
};

if (typeof module !== "undefined") {
  module.exports = { PlatformYouTube };
}
