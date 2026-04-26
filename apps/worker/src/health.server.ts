import * as http from "http";
import type { PrismaClient } from "@crawler-lab/db";
import type Redis from "ioredis";

export function startHealthServer(
  port: number,
  prisma: PrismaClient,
  redis: Redis,
): http.Server {
  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const path = req.url.split("?")[0];
    if (path === "/healthz") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (path === "/readyz") {
      const checks = { postgres: false, redis: false };
      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.postgres = true;
      } catch {
        checks.postgres = false;
      }
      try {
        const pong = await redis.ping();
        checks.redis = pong === "PONG";
      } catch {
        checks.redis = false;
      }
      const ok = checks.postgres && checks.redis;
      res.statusCode = ok ? 200 : 503;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok, checks }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(port, "0.0.0.0");
  return server;
}
