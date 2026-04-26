import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import axios from "axios";
import * as cheerio from "cheerio";
import type { CrawledPage, PrismaClient } from "@crawler-lab/db";
import { PRISMA } from "./prisma.provider";
import { CrawlStage, EventsPublisher } from "./events.publisher";

const QUEUE_NAME = process.env.QUEUE_NAME ?? "crawl";
const CONCURRENCY_CAP = 3;
const CONCURRENCY = Math.min(
  Math.max(parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10) || 1, 1),
  CONCURRENCY_CAP,
);
const USER_AGENT = "crawler-lab/1.0";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_LINKS = 20;
const STAGE_PAUSE_MS = 300;

interface CrawlJobData {
  pageId: string;
  url: string;
}

interface ParsedPage {
  title: string | null;
  description: string | null;
  links: string[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

@Processor(QUEUE_NAME, { concurrency: CONCURRENCY })
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly events: EventsPublisher,
  ) {
    super();
    this.logger.log(`processor concurrency=${CONCURRENCY}`);
  }

  async process(job: Job<CrawlJobData>): Promise<void> {
    if (job.name !== "crawl-url") return;
    const { pageId, url } = job.data;

    await this.events.publish({ type: "started", pageId, url, at: now() });

    // Stage 1: fetch
    let html: string;
    try {
      await this.events.publish({
        type: "stage",
        pageId,
        url,
        stage: "fetch",
        at: now(),
      });
      html = await this.fetchHtml(url);
      await sleep(STAGE_PAUSE_MS);
    } catch (err) {
      await this.fail(pageId, url, "fetch", err);
      return;
    }

    // Stage 2: parse
    let parsed: ParsedPage;
    try {
      await this.events.publish({
        type: "stage",
        pageId,
        url,
        stage: "parse",
        at: now(),
      });
      parsed = this.parseHtml(html, url);
      await sleep(STAGE_PAUSE_MS);
    } catch (err) {
      await this.fail(pageId, url, "parse", err);
      return;
    }

    // Stage 3: persist
    let updated: CrawledPage;
    try {
      await this.events.publish({
        type: "stage",
        pageId,
        url,
        stage: "persist",
        at: now(),
      });
      updated = await this.prisma.crawledPage.update({
        where: { id: pageId },
        data: {
          status: "done",
          title: parsed.title,
          description: parsed.description,
          links: parsed.links,
          error: null,
        },
      });
      await sleep(STAGE_PAUSE_MS);
    } catch (err) {
      await this.fail(pageId, url, "persist", err);
      return;
    }

    await this.events.publish({ type: "done", page: updated, at: now() });
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await axios.get<string>(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { "User-Agent": USER_AGENT },
      responseType: "text",
      transformResponse: [(data) => data],
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof res.data === "string" ? res.data : String(res.data);
  }

  private parseHtml(html: string, baseUrl: string): ParsedPage {
    const $ = cheerio.load(html);
    const title = $("title").first().text().trim() || null;
    const description =
      $('meta[name="description"]').attr("content")?.trim() || null;

    const seen = new Set<string>();
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      if (links.length >= MAX_LINKS) return false;
      const href = $(el).attr("href");
      if (!href) return;
      let abs: string;
      try {
        abs = new URL(href, baseUrl).toString();
      } catch {
        return;
      }
      if (seen.has(abs)) return;
      seen.add(abs);
      links.push(abs);
      return;
    });

    return { title, description, links };
  }

  private async fail(
    pageId: string,
    url: string,
    stage: CrawlStage,
    err: unknown,
  ): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`failed [${stage}] ${url}: ${message}`);
    const updated = await this.prisma.crawledPage.update({
      where: { id: pageId },
      data: { status: "failed", error: `[${stage}] ${message}` },
    });
    await this.events.publish({
      type: "failed",
      page: updated,
      stage,
      at: now(),
    });
  }
}
