import { PrismaClient } from "@prisma/client";

export { PrismaClient } from "@prisma/client";
export type { CrawledPage, Prisma } from "@prisma/client";

let prismaSingleton: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}
