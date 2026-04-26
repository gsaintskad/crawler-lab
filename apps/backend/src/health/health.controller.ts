import { Controller, Get, HttpCode, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import Redis from "ioredis";
import type { PrismaClient } from "@crawler-lab/db";
import { PRISMA } from "../prisma/prisma.module";

@Controller()
export class HealthController {
  private readonly redis: Redis;

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  @Get("healthz")
  @HttpCode(200)
  liveness() {
    return { ok: true };
  }

  @Get("readyz")
  async readiness(@Res() res: Response) {
    const checks: Record<string, boolean> = { postgres: false, redis: false };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = true;
    } catch {
      checks.postgres = false;
    }
    try {
      const pong = await this.redis.ping();
      checks.redis = pong === "PONG";
    } catch {
      checks.redis = false;
    }
    const ok = checks.postgres && checks.redis;
    res.status(ok ? 200 : 503).json({ ok, checks });
  }
}
