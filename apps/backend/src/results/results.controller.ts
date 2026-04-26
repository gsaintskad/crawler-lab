import { Controller, Get, Query } from "@nestjs/common";
import { ResultsService } from "./results.service";

@Controller("api/results")
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  @Get()
  async list(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const parsedLimit = Math.min(
      Math.max(parseInt(limit ?? "50", 10) || 50, 1),
      200,
    );
    const parsedOffset = Math.max(parseInt(offset ?? "0", 10) || 0, 0);
    const allowed = new Set(["pending", "done", "failed"]);
    const statusFilter = status && allowed.has(status) ? status : undefined;
    return this.service.list(statusFilter, parsedLimit, parsedOffset);
  }
}
