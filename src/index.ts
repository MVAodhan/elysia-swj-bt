import cron from "@elysiajs/cron";
import { Elysia } from "elysia";

import { YouTubeChatService } from "./lib/youtube";
import { time, WebhookClient } from "discord.js";
import { setToArray } from "./lib/utils";

const apiKey = process.env.YOUTUBE_API_KEY || "";
const webhookId = process.env.DISCORD_WEBHOOK_ID || "";
const webhookToken = process.env.DISCORD_WEBHOOK_TOKEN || "";
const ytService = new YouTubeChatService(apiKey);
const webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });
const channelId = process.env.YOUTUBE_CHANNEL_ID;

const uniqueLinks = new Set<string>();
const linksMap = new Map<string, []>();

let allLinks: { [x: string]: string }[][] = [];

const app = new Elysia()
  .use(
    cron({
      name: "polling",
      pattern: "30 17 * * 4",
      async run() {
        const res = await ytService.findLiveStreams(channelId!);
        ytService.startPolling(res[0]!, (link) => {
          console.log(`Link found: ${link}`);
          if (!uniqueLinks.has(link)) {
            webhookClient.send({
              content: link,
            });
            uniqueLinks.add(link);
          }
        });
        setTimeout(() => {
          ytService.stopPolling();
          const linksMapAsArr = setToArray(uniqueLinks, linksMap);
          allLinks = [...allLinks, linksMapAsArr];
          uniqueLinks.clear();
          linksMap.clear();
        }, 10800000);
      },
    })
  )
  .get("/links", () => {
    const links = allLinks;
    allLinks = [];
    return {
      links,
    };
  })
  .get("/health", () => {
    return {
      status: "live",
      date: new Date(),
    };
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
