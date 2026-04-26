import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CrawlController } from "./crawl.controller";
import { CrawlService } from "./crawl.service";

const QUEUE_NAME = process.env.QUEUE_NAME ?? "crawl";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAME })],
  controllers: [CrawlController],
  providers: [CrawlService],
})
export class CrawlModule {}
