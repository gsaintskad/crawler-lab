# Build from the monorepo root:
#   docker build -f apps/worker/Dockerfile -t crawler-lab/worker .

FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/backend/package.json ./apps/backend/
COPY apps/worker/package.json ./apps/worker/
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/db ./packages/db
COPY apps/worker ./apps/worker
RUN pnpm --filter @crawler-lab/db exec prisma generate \
 && pnpm --filter @crawler-lab/db build \
 && pnpm --filter @crawler-lab/worker build \
 && pnpm deploy --filter=@crawler-lab/worker --prod --legacy /out

FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
ENV HEALTH_PORT=3001
WORKDIR /app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
