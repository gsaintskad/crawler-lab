import { Global, Module, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@crawler-lab/db";

export const PRISMA = Symbol("PRISMA_CLIENT");

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: () => new PrismaClient(),
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule implements OnModuleDestroy {
  constructor() {}
  async onModuleDestroy() {
    // Prisma manages its own pool; nothing to do here.
  }
}
