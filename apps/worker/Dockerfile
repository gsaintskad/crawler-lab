# Build from the monorepo root:
#   docker build -f apps/worker/Dockerfile -t crawler-lab/worker .

FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db ./packages/db
COPY apps/backend/package.json ./apps/backend/
COPY apps/worker/package.json ./apps/worker/
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/worker ./apps/worker
RUN pnpm --filter @crawler-lab/worker build
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
RUN addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
ENV HEALTH_PORT=3001
WORKDIR /app
COPY --from=build --chown=app:app /repo /app
USER app
EXPOSE 3001
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
