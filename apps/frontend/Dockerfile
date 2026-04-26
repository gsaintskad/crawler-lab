# Build from the monorepo root:
#   docker build -f apps/frontend/Dockerfile -t crawler-lab/frontend .

FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
# Placeholder so the workspace-wide `prisma generate` (db's prepare hook)
# can validate the schema during install.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# packages/db has a `prepare` hook that pnpm runs across the whole workspace,
# so include its schema + source even though the frontend doesn't use it.
COPY packages/db ./packages/db
COPY apps/backend/package.json ./apps/backend/
COPY apps/worker/package.json ./apps/worker/
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/frontend ./apps/frontend
RUN pnpm --filter @crawler-lab/frontend build

FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=app:app /repo/apps/frontend/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build --chown=app:app /repo/apps/frontend/public ./apps/frontend/public
USER app
EXPOSE 3002
WORKDIR /app/apps/frontend
CMD ["node", "server.js"]
