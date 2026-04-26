import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import type { CrawledPage } from "@crawler-lab/db";

export const EVENTS_CHANNEL = "crawler-lab:events";

export type CrawlStage = "fetch" | "parse" | "persist";

export type CrawlEvent =
  | { type: "started"; pageId: string; url: string; at: string }
  | { type: "stage"; pageId: string; url: string; stage: CrawlStage; at: string }
  | { type: "done"; page: CrawledPage; at: string }
  | { type: "failed"; page: CrawledPage; stage?: CrawlStage; at: string };

@Injectable()
export class EventsPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(EventsPublisher.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }

  async publish(event: CrawlEvent): Promise<void> {
    try {
      await this.redis.publish(EVENTS_CHANNEL, JSON.stringify(event));
    } catch (err) {
      this.logger.warn(
        `publish failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
