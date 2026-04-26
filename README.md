# crawler-lab

A small web-crawling app: a Next.js dashboard pushes URLs into a Nest.js REST API,
which enqueues BullMQ jobs that a Nest.js worker consumes to fetch and parse pages
with axios + cheerio. Postgres stores results via Prisma; Redis backs the queue.

The worker also publishes `started` / `done` / `failed` events on a Redis pub/sub
channel (`crawler-lab:events`). The backend bridges that channel to a Socket.IO
gateway, and the frontend renders a live activity feed from those events.

## Layout

```
crawler-lab/
├── apps/
│   ├── backend/      Nest.js REST API + BullMQ producer
│   ├── worker/       Nest.js standalone, BullMQ consumer
│   └── frontend/     Next.js (App Router) dashboard
├── packages/
│   └── db/           Shared Prisma schema + client
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker (for Postgres + Redis)

## 1. Install

```bash
pnpm install
```

The `@crawler-lab/db` package has a `prepare` script that runs `prisma generate`
and compiles its `dist/`, so the apps can resolve `@crawler-lab/db` immediately
after install. If it ever gets out of sync (e.g. after a schema edit), rebuild
with `pnpm build:db`.

## 2. Start Postgres + Redis

```bash
docker compose up -d
```

Postgres listens on `localhost:5432` (db `crawler`, user/password `crawler`/`crawler`).
Redis listens on `localhost:6379` (no password).

## 3. Run Prisma migrations

Prisma reads `DATABASE_URL` from `packages/db/.env`. A local-dev file is included
that matches the docker-compose credentials. If yours is missing, copy the
template:

```bash
cp packages/db/.env.example packages/db/.env
```

Then run:

```bash
pnpm prisma:migrate     # creates the migration & applies it
pnpm prisma:generate    # regenerates the client (run after schema edits)
```

## 4. Run each app

Each app reads its config from environment variables. Open three terminals:

### Backend (REST API + queue producer)

```bash
export DATABASE_URL="postgresql://crawler:crawler@localhost:5432/crawler?schema=public"
export REDIS_HOST=localhost
export REDIS_PORT=6379
export PORT=3000
pnpm dev:backend
```

Endpoints:

- `POST /api/crawl` — `{ "urls": ["..."] }` (up to 1000)
- `GET  /api/results?status=&limit=&offset=`
- `GET  /api/stats`
- `GET  /healthz`
- `GET  /readyz`

### Worker (queue consumer)

```bash
export DATABASE_URL="postgresql://crawler:crawler@localhost:5432/crawler?schema=public"
export REDIS_HOST=localhost
export REDIS_PORT=6379
export WORKER_CONCURRENCY=5
export HEALTH_PORT=3001
pnpm dev:worker
```

Health endpoints on `http://localhost:3001/healthz` and `/readyz`.

### Frontend (Next.js dashboard)

```bash
export NEXT_PUBLIC_API_URL=http://localhost:3000
pnpm dev:frontend
```

Open `http://localhost:3002`.

## Required env vars

| App      | Var                     | Default     | Notes                                  |
| -------- | ----------------------- | ----------- | -------------------------------------- |
| backend  | `DATABASE_URL`          | —           | Postgres connection string             |
| backend  | `REDIS_HOST`            | `localhost` |                                        |
| backend  | `REDIS_PORT`            | `6379`      |                                        |
| backend  | `REDIS_PASSWORD`        | (unset)     | Optional                               |
| backend  | `PORT`                  | `3000`      |                                        |
| backend  | `QUEUE_NAME`            | `crawl`     |                                        |
| worker   | `DATABASE_URL`          | —           |                                        |
| worker   | `REDIS_HOST`            | `localhost` |                                        |
| worker   | `REDIS_PORT`            | `6379`      |                                        |
| worker   | `REDIS_PASSWORD`        | (unset)     |                                        |
| worker   | `QUEUE_NAME`            | `crawl`     |                                        |
| worker   | `WORKER_CONCURRENCY`    | `5`         | BullMQ worker concurrency              |
| worker   | `HEALTH_PORT`           | `3001`      | HTTP port for `/healthz` and `/readyz` |
| frontend | `NEXT_PUBLIC_API_URL`   | —           | e.g. `http://localhost:3000`           |

## Build all

```bash
pnpm build:all
```

## Docker images

Each app has its own Dockerfile that builds from the monorepo root:

```bash
docker build -f apps/backend/Dockerfile  -t crawler-lab/backend  .
docker build -f apps/worker/Dockerfile   -t crawler-lab/worker   .
docker build -f apps/frontend/Dockerfile -t crawler-lab/frontend .
```
