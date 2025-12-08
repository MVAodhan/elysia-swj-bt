import { google } from "googleapis";

export class YouTubeChatService {
  private youtube;
  private apiKey: string;
  private isPolling: boolean = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.youtube = google.youtube({
      version: "v3",
      auth: this.apiKey,
    });
  }

  async findLiveStreams(channelId: string): Promise<string[]> {
    try {
      const response = await this.youtube.search.list({
        part: ["id"],
        channelId,
        eventType: "live",
        type: ["video"],
      });

      return (
        response.data.items
          ?.map((item) => item.id?.videoId)
          .filter((id): id is string => !!id) || []
      );
    } catch (error) {
      console.error("Error finding live streams:", error);
      return [];
    }
  }

  async getLiveChatId(videoId: string): Promise<string | null> {
    try {
      const response = await this.youtube.videos.list({
        part: ["liveStreamingDetails"],
        id: [videoId],
      });

      const video = response.data.items?.[0];
      console.log("live streamind details", video?.liveStreamingDetails);

      return video?.liveStreamingDetails?.activeLiveChatId || null;
    } catch (error) {
      console.error("Error fetching live chat ID:", error);
      return null;
    }
  }

  async getChatMessages(liveChatId: string, pageToken?: string) {
    try {
      const response = await this.youtube.liveChatMessages.list({
        liveChatId,
        part: ["snippet", "authorDetails"],
        pageToken,
      });

      return {
        messages: response.data.items || [],
        nextPageToken: response.data.nextPageToken,
        pollingIntervalMillis: response.data.pollingIntervalMillis,
      };
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      throw error;
    }
  }

  extractLinks(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? Array.from(matches) : [];
  }

  async startPolling(videoId: string, onLinkFound: (link: string) => void) {
    if (this.isPolling) {
      console.log("Already polling");
      return;
    }

    const liveChatId = await this.getLiveChatId(videoId);
    if (!liveChatId) {
      console.error("No active live chat found for this video.");
      return;
    }

    console.log(`Found Live Chat ID: ${liveChatId}. Starting poll...`);
    this.isPolling = true;
    let nextPageToken: string | undefined = undefined;

    while (this.isPolling) {
      try {
        const result = await this.getChatMessages(liveChatId, nextPageToken);
        nextPageToken = result.nextPageToken || undefined;

        // Respect the polling interval requested by YouTube
        const sleepTime = result.pollingIntervalMillis || 5000;

        for (const msg of result.messages) {
          // Check if author is the channel owner (host)
          // Also optionally could check isChatModerator if desired
          if (msg.authorDetails?.isChatOwner) {
            const text = msg.snippet?.displayMessage || "";
            const links = this.extractLinks(text);

            if (links.length > 0) {
              links.forEach((link) => {
                onLinkFound(link);
              });
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      } catch (error) {
        console.error("Polling error, retrying in 5s...", error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  stopPolling() {
    this.isPolling = false;
    console.log("Stopped polling.");
  }
}
