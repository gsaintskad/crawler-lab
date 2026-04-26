import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { startHealthServer } from "./health.server";
import { PrismaClient } from "@crawler-lab/db";
import Redis from "ioredis";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init();

  const prisma = new PrismaClient();
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  const healthPort = parseInt(process.env.HEALTH_PORT ?? "3001", 10);
  const healthServer = startHealthServer(healthPort, prisma, redis);

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`worker received ${signal}, shutting down`);
    healthServer.close();
    try {
      await app.close();
    } catch {
      /* ignore */
    }
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    try {
      redis.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // eslint-disable-next-line no-console
  console.log(`worker started; health on :${healthPort}`);
}

bootstrap();
