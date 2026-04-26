import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { CrawlService } from "./crawl.service";

interface CrawlRequest {
  urls?: unknown;
}

@Controller("api/crawl")
export class CrawlController {
  constructor(private readonly service: CrawlService) {}

  @Post()
  async crawl(@Body() body: CrawlRequest) {
    const urls = body?.urls;
    if (!Array.isArray(urls)) {
      throw new BadRequestException("urls must be an array of strings");
    }
    if (urls.length === 0) {
      throw new BadRequestException("urls must not be empty");
    }
    if (urls.length > 1000) {
      throw new BadRequestException("at most 1000 urls per request");
    }
    const valid: string[] = [];
    for (const u of urls) {
      if (typeof u !== "string") {
        throw new BadRequestException("urls must be strings");
      }
      const trimmed = u.trim();
      if (!trimmed) continue;
      try {
        // throws if invalid
        new URL(trimmed);
        valid.push(trimmed);
      } catch {
        throw new BadRequestException(`invalid url: ${trimmed}`);
      }
    }
    const enqueued = await this.service.enqueue(valid);
    return { enqueued };
  }
}
