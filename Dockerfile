# Game server image. Build from the repo root:
#   docker build -t doodle-game-server .
#   docker run -p 4001:4001 -e JWT_SECRET=... -e ALLOW_DEV_TOKENS=true doodle-game-server
#
# Runs with rooms in memory unless REDIS_URL is set.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Install with only the manifests so this layer is cached until dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/game-server/package.json apps/game-server/
RUN pnpm install --frozen-lockfile --filter @doodle/game-server...

COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/game-server apps/game-server
RUN pnpm --filter @doodle/game-server... build
RUN pnpm --filter @doodle/game-server... install --prod --frozen-lockfile --offline

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/game-server/package.json apps/game-server/
COPY --from=build /app/apps/game-server/node_modules apps/game-server/node_modules
COPY --from=build /app/apps/game-server/dist apps/game-server/dist

USER node
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT:-4001}/health || exit 1
CMD ["node", "apps/game-server/dist/server.js"]
