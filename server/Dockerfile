# syntax=docker/dockerfile:1.4
# federationcoin-radar (private ECR). API entrypoint; CronJob overrides
# to node dist/collector.main.js. Dummy MAIN is unused.

FROM node:22-bookworm AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY openapi ./openapi
COPY migrations ./migrations
RUN npx tsc -p tsconfig.build.json && npm prune --omit=dev

FROM node:22-bookworm
RUN useradd --uid 65532 --create-home --home-dir /nonexistent --shell /usr/sbin/nologin radar \
  && mkdir -p /app /tmp/radar && chown -R 65532:65532 /app /tmp/radar
WORKDIR /app
COPY --from=build --chown=65532:65532 /src/dist ./dist
COPY --from=build --chown=65532:65532 /src/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /src/package.json ./package.json
COPY --from=build --chown=65532:65532 /src/openapi ./openapi
COPY --from=build --chown=65532:65532 /src/migrations ./migrations
USER 65532:65532
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["node", "dist/main.js"]
