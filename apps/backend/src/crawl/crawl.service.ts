import { Inject, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { PrismaClient } from "@crawler-lab/db";
import { PRISMA } from "../prisma/prisma.module";

const QUEUE_NAME = process.env.QUEUE_NAME ?? "crawl";

@Injectable()
export class CrawlService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @InjectQueue(QUEUE_NAME) private readonly queue: Queue,
  ) {}

  async enqueue(urls: string[]): Promise<number> {
    let enqueued = 0;
    for (const url of urls) {
      const page = await this.prisma.crawledPage.create({
        data: { url, status: "pending", links: [] },
      });
      await this.queue.add(
        "crawl-url",
        { pageId: page.id, url },
        { removeOnComplete: 1000, removeOnFail: 1000 },
      );
      enqueued++;
    }
    return enqueued;
  }
}
