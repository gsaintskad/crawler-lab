import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@crawler-lab/db";
import { PRISMA } from "../prisma/prisma.module";

@Injectable()
export class ResultsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(status: string | undefined, limit: number, offset: number) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.crawledPage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.crawledPage.count({ where }),
    ]);
    return { items, total, limit, offset };
  }
}
