# DEPRECATED — belongs to the retired Postgres/server variant (docs/06-deploy.md).
# The app is a Windows desktop build with embedded SQLite now: this file expects
# DATABASE_URL, which the code no longer reads. Kept as a record of the server
# variant; the shipping path is docs/09-desktop-app.md.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/gtfs/package.json packages/gtfs/package.json
COPY packages/xlsx/package.json packages/xlsx/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @citybus/web build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "--filter", "@citybus/web", "start"]
