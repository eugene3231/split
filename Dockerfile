# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
ARG DEBIAN_SUITE=trixie

FROM node:${NODE_VERSION}-${DEBIAN_SUITE}-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY vite.server.config.ts ./
COPY server ./server
COPY src/shared ./src/shared
COPY src/features/receipt-scanner ./src/features/receipt-scanner
RUN pnpm run build:server

FROM node:${NODE_VERSION}-${DEBIAN_SUITE}-slim AS runtime
ARG GIT_SHA=dev
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o 1001 -g 10 /data
WORKDIR /app
COPY --from=build /app/dist/server/main.js ./main.js

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    APP_VERSION=${GIT_SHA}
USER 1001:10
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --start-interval=1s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/v1/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["/usr/bin/tini", "--", "node", "/app/main.js"]
