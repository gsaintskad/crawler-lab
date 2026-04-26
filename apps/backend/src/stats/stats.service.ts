import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@crawler-lab/db";
import { PRISMA } from "../prisma/prisma.module";

@Injectable()
export class StatsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async stats() {
    const groups = await this.prisma.crawledPage.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const result = { pending: 0, done: 0, failed: 0 };
    for (const g of groups) {
      if (g.status === "pending") result.pending = g._count._all;
      else if (g.status === "done") result.done = g._count._all;
      else if (g.status === "failed") result.failed = g._count._all;
    }
    return result;
  }
}
