import { Provider } from "@nestjs/common";
import { PrismaClient } from "@crawler-lab/db";

export const PRISMA = Symbol("PRISMA_CLIENT");

export const PrismaProvider: Provider = {
  provide: PRISMA,
  useFactory: () => new PrismaClient(),
};
