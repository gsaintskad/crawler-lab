import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CrawlProcessor } from "./crawl.processor";
import { PrismaProvider } from "./prisma.provider";
import { EventsPublisher } from "./events.publisher";

const QUEUE_NAME = process.env.QUEUE_NAME ?? "crawl";

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({ name: QUEUE_NAME }),
  ],
  providers: [PrismaProvider, EventsPublisher, CrawlProcessor],
})
export class AppModule {}
