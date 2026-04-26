# Build from the monorepo root:
#   docker build -f apps/backend/Dockerfile -t crawler-lab/backend .

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
COPY apps/backend ./apps/backend
RUN pnpm --filter @crawler-lab/db exec prisma generate \
 && pnpm --filter @crawler-lab/db build \
 && pnpm --filter @crawler-lab/backend build \
 && pnpm deploy --filter=@crawler-lab/backend --prod --legacy /out

FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
