FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages
COPY tasks/zip-downloader ./tasks/zip-downloader

# Partial monorepo context — do not use --frozen-lockfile (lockfile assumes all workspaces)
RUN bun install

FROM oven/bun:1-slim AS production
WORKDIR /app

# Copy the full install tree so workspace symlinks and .bun store stay intact
COPY --from=base /app/package.json /app/bun.lock ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/tasks/zip-downloader ./tasks/zip-downloader

WORKDIR /app/tasks/zip-downloader
CMD ["bun", "run", "src/index.ts"]
