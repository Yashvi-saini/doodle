# doodle

Multiplayer doodle guessing game. pnpm workspaces + Turborepo monorepo.

| Path               | What                                            |
| ------------------ | ----------------------------------------------- |
| `apps/mobile`      | Expo (dev build) React Native app               |
| `apps/game-server` | Socket.IO realtime server, server-authoritative |
| `apps/api`         | Fastify REST API (auth, profiles, word packs)   |
| `packages/shared`  | Zod schemas and types shared by every app       |
| `packages/db`      | Drizzle schema, migrations and client           |
| `packages/config`  | Shared TypeScript and ESLint config             |

## Requirements

- Node 22.12+
- pnpm 10 (`corepack enable`)
- Docker Desktop

## Getting started

```sh
pnpm install
```
