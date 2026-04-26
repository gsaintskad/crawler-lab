"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface CrawledPage {
  id: string;
  url: string;
  status: string;
  title: string | null;
  description: string | null;
  links: string[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ResultsResponse {
  items: CrawledPage[];
  total: number;
  limit: number;
  offset: number;
}

interface Stats {
  pending: number;
  done: number;
  failed: number;
}

type CrawlStage = "fetch" | "parse" | "persist";

type CrawlEvent =
  | { type: "started"; pageId: string; url: string; at: string }
  | { type: "stage"; pageId: string; url: string; stage: CrawlStage; at: string }
  | { type: "done"; page: CrawledPage; at: string }
  | { type: "failed"; page: CrawledPage; stage?: CrawlStage; at: string };

type FeedKind = CrawlEvent["type"] | CrawlStage;

interface FeedEntry {
  key: string;
  kind: FeedKind;
  url: string;
  title: string | null;
  error: string | null;
  at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const FEED_LIMIT = 30;

function liveDot(connected: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: connected ? "#22c55e" : "#9ca3af",
    marginRight: 6,
    verticalAlign: "middle",
  };
}

const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  done: { bg: "#dcfce7", fg: "#166534" },
  failed: { bg: "#fee2e2", fg: "#991b1b" },
  started: { bg: "#dbeafe", fg: "#1e40af" },
  pending: { bg: "#fef3c7", fg: "#92400e" },
  fetch: { bg: "#ede9fe", fg: "#5b21b6" },
  parse: { bg: "#cffafe", fg: "#155e75" },
  persist: { bg: "#fce7f3", fg: "#9d174d" },
};

function badge(kind: string): React.CSSProperties {
  const c = BADGE_COLORS[kind] ?? BADGE_COLORS.pending;
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: c.bg,
    color: c.fg,
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: "0 auto", padding: "32px 20px" },
  h1: { margin: 0, fontSize: 24 },
  card: {
    background: "white",
    border: "1px solid #e5e5e7",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: 600, color: "#222" },
  textarea: {
    width: "100%",
    minHeight: 120,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    padding: 8,
    border: "1px solid #d0d0d4",
    borderRadius: 6,
  },
  button: {
    marginTop: 8,
    padding: "8px 16px",
    background: "#1a1a1a",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
  },
  buttonDisabled: { opacity: 0.6, cursor: "not-allowed" },
  statsRow: { display: "flex", gap: 16 },
  statBox: {
    flex: 1,
    background: "#fafafa",
    border: "1px solid #ececef",
    borderRadius: 6,
    padding: 12,
    textAlign: "center" as const,
  },
  statLabel: { fontSize: 12, color: "#666", textTransform: "uppercase" as const },
  statValue: { fontSize: 24, fontWeight: 600, marginTop: 4 },
  table: { width: "100%", fontSize: 13 },
  th: {
    textAlign: "left" as const,
    padding: "8px",
    borderBottom: "1px solid #e5e5e7",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase" as const,
    color: "#666",
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #f0f0f2",
    verticalAlign: "top" as const,
  },
  feedList: { maxHeight: 320, overflowY: "auto" as const, fontSize: 13 },
  feedRow: {
    display: "grid",
    gridTemplateColumns: "70px 80px 1fr",
    gap: 8,
    padding: "6px 0",
    borderBottom: "1px solid #f3f4f6",
    alignItems: "center",
  },
  feedTime: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    color: "#888",
  },
  feedUrl: { wordBreak: "break-all" as const },
  feedError: { color: "#991b1b", fontSize: 12 },
  message: { marginTop: 8, fontSize: 13, color: "#444" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function HomePage() {
  const [textarea, setTextarea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ pending: 0, done: 0, failed: 0 });
  const [results, setResults] = useState<CrawledPage[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const aliveRef = useRef(true);

  async function refresh() {
    try {
      const [statsRes, resultsRes] = await Promise.all([
        fetch(`${API_URL}/api/stats`, { cache: "no-store" }),
        fetch(`${API_URL}/api/results?limit=50`, { cache: "no-store" }),
      ]);
      if (!aliveRef.current) return;
      if (statsRes.ok) {
        const s = (await statsRes.json()) as Stats;
        setStats(s);
      }
      if (resultsRes.ok) {
        const r = (await resultsRes.json()) as ResultsResponse;
        setResults(r.items);
      }
    } catch {
      /* ignore poll errors */
    }
  }

  useEffect(() => {
    aliveRef.current = true;
    refresh();
    const id = setInterval(refresh, 2000);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket: Socket = io(API_URL, {
      transports: ["websocket"],
      reconnection: true,
    });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("crawl:event", (event: CrawlEvent) => {
      const entry: FeedEntry = (() => {
        switch (event.type) {
          case "started":
            return {
              key: `${event.pageId}-started-${event.at}`,
              kind: "started",
              url: event.url,
              title: null,
              error: null,
              at: event.at,
            };
          case "stage":
            return {
              key: `${event.pageId}-${event.stage}-${event.at}`,
              kind: event.stage,
              url: event.url,
              title: null,
              error: null,
              at: event.at,
            };
          case "done":
            return {
              key: `${event.page.id}-done-${event.at}`,
              kind: "done",
              url: event.page.url,
              title: event.page.title,
              error: null,
              at: event.at,
            };
          case "failed":
            return {
              key: `${event.page.id}-failed-${event.at}`,
              kind: "failed",
              url: event.page.url,
              title: null,
              error: event.page.error,
              at: event.at,
            };
        }
      })();
      setFeed((prev) => [entry, ...prev].slice(0, FEED_LIMIT));
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const urls = textarea
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setMessage("Enter at least one URL");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/crawl`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) {
        const text = await res.text();
        setMessage(`Error: ${text}`);
      } else {
        const json = (await res.json()) as { enqueued: number };
        setMessage(`Enqueued ${json.enqueued} URLs`);
        setTextarea("");
        refresh();
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>crawler-lab</h1>

      <section style={styles.card}>
        <form onSubmit={handleSubmit}>
          <label htmlFor="urls" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
            URLs (one per line, up to 1000)
          </label>
          <textarea
            id="urls"
            style={styles.textarea}
            value={textarea}
            onChange={(e) => setTextarea(e.target.value)}
            placeholder="https://example.com&#10;https://news.ycombinator.com"
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.button,
              ...(submitting ? styles.buttonDisabled : {}),
            }}
          >
            {submitting ? "Crawling…" : "Crawl"}
          </button>
          {message && <div style={styles.message}>{message}</div>}
        </form>
      </section>

      <section style={styles.card}>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Pending</div>
            <div style={styles.statValue}>{stats.pending}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Done</div>
            <div style={styles.statValue}>{stats.done}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Failed</div>
            <div style={styles.statValue}>{stats.failed}</div>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>Live activity</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            <span style={liveDot(connected)} />
            {connected ? "live" : "offline"}
          </div>
        </div>
        <div style={styles.feedList}>
          {feed.length === 0 ? (
            <div style={{ color: "#999", padding: "8px 0" }}>
              Waiting for events…
            </div>
          ) : (
            feed.map((entry) => (
              <div key={entry.key} style={styles.feedRow}>
                <div style={styles.feedTime}>{formatTime(entry.at)}</div>
                <div>
                  <span style={badge(entry.kind)}>{entry.kind}</span>
                </div>
                <div style={styles.feedUrl}>
                  {entry.url}
                  {entry.title && (
                    <div style={{ color: "#666", fontSize: 12 }}>{entry.title}</div>
                  )}
                  {entry.error && <div style={styles.feedError}>{entry.error}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>Last 50 results</div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>URL</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={4}>
                  No results yet.
                </td>
              </tr>
            ) : (
              results.map((row) => (
                <tr key={row.id}>
                  <td style={{ ...styles.td, maxWidth: 320, wordBreak: "break-all" }}>
                    {row.url}
                  </td>
                  <td style={styles.td}>
                    <span style={badge(row.status)}>{row.status}</span>
                  </td>
                  <td style={{ ...styles.td, maxWidth: 360 }}>{row.title ?? ""}</td>
                  <td style={styles.td}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
