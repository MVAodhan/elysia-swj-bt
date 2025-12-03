import cron from "@elysiajs/cron";
import { Elysia } from "elysia";

import { YouTubeChatService } from "../lib/youtube";
import { WebhookClient } from "discord.js";

const apiKey = process.env.YOUTUBE_API_KEY || "";
const webhookId = process.env.DISCORD_WEBHOOK_ID || "";
const webhookToken = process.env.DISCORD_WEBHOOK_TOKEN || "";
const ytService = new YouTubeChatService(apiKey);
const webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });

const collectedLinks: { link: string; author: string; timestamp: string }[] =
  [];

const channelId = process.env.YOUTUBE_CHANNEL_ID;
const app = new Elysia()
  .use(
    cron({
      name: "polling",
      pattern: "56 23 * * *",
      async run() {
        const res = await ytService.findLiveStreams(channelId!);

        ytService.startPolling(res[0]!, (link, author) => {
          console.log(`Link found: ${link} from ${author}`);

          webhookClient.send({
            content: link,
          });

          collectedLinks.push({
            link,
            author,
            timestamp: new Date().toISOString(),
          });
        });

        setTimeout(() => {
          fetch("http://localhost:3000/stop");
        }, 120000);
      },
    })
  )
  .get(
    "/stop",
    ({
      store: {
        cron: { polling },
      },
    }) => {
      polling.stop();
      console.log("polling stopped");
    }
  )
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
