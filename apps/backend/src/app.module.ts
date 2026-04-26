import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./prisma/prisma.module";
import { CrawlModule } from "./crawl/crawl.module";
import { ResultsModule } from "./results/results.module";
import { StatsModule } from "./stats/stats.module";
import { HealthModule } from "./health/health.module";
import { EventsModule } from "./events/events.module";

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
    PrismaModule,
    CrawlModule,
    ResultsModule,
    StatsModule,
    HealthModule,
    EventsModule,
  ],
})
export class AppModule {}
