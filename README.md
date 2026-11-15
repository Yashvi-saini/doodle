# doodle

Multiplayer doodle guessing game. One player draws, everyone else guesses. TypeScript end to end, in a pnpm workspaces + Turborepo monorepo.

| Path               | What                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `apps/mobile`      | Expo dev-build app: React Native Skia, Gesture Handler, Reanimated |
| `apps/game-server` | Socket.IO realtime server, server-authoritative, Redis-backed      |
| `apps/api`         | Fastify REST API: auth, profiles, word packs                       |
| `packages/shared`  | Zod schemas and types for every socket event and API payload       |
| `packages/db`      | Drizzle schema, migrations and Postgres client                     |
| `packages/config`  | Shared TypeScript config                                           |

## Status

**Phase 2: multiplayer game.** Create a room, share the 6-letter code, and play: the drawer picks one of three words, draws with a live-streamed Skia canvas, and everyone else guesses in chat. Faster guesses score more, the drawer scores per correct guess, letters are revealed as hints over the turn, and a leaderboard is shown at the end. Guesses that are one letter off get a "close" nudge. Drawers can undo and clear; disconnects and reconnects are handled.

The solo sketchpad from phase 1 is still available from the home screen. Rooms (create, join, leave, settings, kick) are server-authoritative. The REST API's auth and profile routes still return `NOT_IMPLEMENTED`; players currently identify with a dev token.

## Requirements

- Node 22.12+ and pnpm 10 (`corepack enable`)
- Docker Desktop, for Postgres 18 and Redis 8
- For the mobile app: Android Studio, JDK 17 and an Android phone or emulator (see below)

## Quick start (no Docker)

Enough to play a game on two phones:

```sh
pnpm install
pnpm --filter @doodle/game-server dev:memory   # rooms kept in memory, no Redis needed
pnpm --filter @doodle/mobile android           # see "Running the mobile app" below
```

The app connects to port 4001 on the machine running Metro. If the phone can't reach it, open the server field on the home screen and enter `http://<your-pc-ip>:4001`.

## Full setup (Postgres + Redis)

```sh
pnpm install
cp .env.example .env
docker compose up -d
pnpm --filter @doodle/db db:migrate
pnpm build
```

Run the servers in two terminals:

```sh
pnpm --filter @doodle/api dev            # http://localhost:4000/health
pnpm --filter @doodle/game-server dev    # http://localhost:4001/health
```

## Everyday commands

| Command                                | What it does                                              |
| -------------------------------------- | --------------------------------------------------------- |
| `pnpm lint`                            | ESLint in every package (type-aware rules)                |
| `pnpm typecheck`                       | `tsc --noEmit` in every package                           |
| `pnpm test`                            | Vitest in every package                                   |
| `pnpm format`                          | Prettier                                                  |
| `pnpm --filter @doodle/db db:generate` | Create a migration after editing `packages/db/src/schema` |
| `pnpm --filter @doodle/db db:migrate`  | Apply migrations to `DATABASE_URL`                        |
| `pnpm --filter @doodle/db db:studio`   | Browse the database in Drizzle Studio                     |
| `docker compose stop`                  | Stop Postgres and Redis (data is kept)                    |

Database and Redis integration tests use `TEST_DATABASE_URL` and `TEST_REDIS_URL` from `.env`. Docker creates the `doodle_test` database on first start. In CI these variables are required, so the tests can't silently skip.

## Running the mobile app (Android)

The app uses an Expo **dev build**, so the first run compiles native code with Gradle on your machine.

### One-time setup

1. Install **Android Studio**. In the setup wizard keep _Android SDK_, _Android SDK Platform_ and _Android Virtual Device_ checked.
2. In **SDK Manager**, tick _Show Package Details_ and install:
   - _Android 15 (VanillaIceCream)_: **Android SDK Platform 35**, plus a **Google APIs x86_64** system image if you want an emulator.
   - _SDK Tools_: **Build-Tools 36.0.0** and **Android SDK Command-line Tools (latest)**.
3. Install the **Microsoft Build of OpenJDK 17** with _Set JAVA_HOME_ and _Add to PATH_ ticked.
4. Add the user environment variable `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`, and add `%LOCALAPPDATA%\Android\Sdk\platform-tools` to your user `Path`.
5. Enable Windows long paths. In an **Administrator** PowerShell:
   ```powershell
   New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
   git config --global core.longpaths true
   ```
6. Build from a path **without spaces**, because native C++ builds (CMake/Ninja) break on them. Either clone the repo to `C:\dev\doodle`, or map a drive letter for the session:
   ```powershell
   subst X: "C:\Users\<you>\Desktop\hackyy"
   cd X:\doodle
   ```
   A `subst` mapping lasts until you sign out, so re-run it after a restart.
7. On your phone, turn on **Developer options → USB debugging** and connect it by USB, or start an emulator from Android Studio's Device Manager.

Then restart your terminal or VS Code and check everything:

```sh
pnpm check:android
```

### Build and run

```sh
pnpm --filter @doodle/mobile android    # first time: generates android/, builds with Gradle, installs and starts Metro
pnpm --filter @doodle/mobile dev        # after that: start Metro only, then open the installed app
```

Rebuild with `android` again only after adding or upgrading a native library. JavaScript changes reload instantly through Metro. `android/` and `ios/` are generated from `app.json` (Expo prebuild) and are not committed.

## Architecture notes

- **Shared contract.** `packages/shared/src/socket.ts` maps every client event to its payload schema and optional ack schema. The Socket.IO `ClientToServerEvents` / `ServerToClientEvents` types are derived from that map, and the server validates every incoming payload against it before a handler runs.
- **Game server layers.** `handlers` validate and route socket events. `services` hold the rules: host-only actions, room capacity, host hand-over. `repositories` own Redis state. Room updates take a per-room Redis lock, so concurrent joins can't overfill a room.
- **API layers.** `routes → service → repository`, with Zod schemas from `@doodle/shared` for request validation and response serialisation.
- **Game loop.** `services/game.service.ts` drives a turn through `choosing → drawing → turn_end` with timers for the word choice, hint reveals and the turn itself. Room state lives in the repository; the current turn's strokes live in process memory so the drawer never takes the room lock. Guess matching, hints and scoring are pure functions in `game-rules.ts`.
- **Mobile game state.** `features/game/store/game.store.ts` owns the socket and applies every server event to a Zustand store; screens are chosen from the room phase. The drawer's strokes are streamed in 8-point chunks via `draw:stroke_points` and committed on release.
- **Canvas.** The stroke being drawn is built on the UI thread: Gesture Handler 3 worklets feed a Skia `usePathValue`. On release, its points are normalised to 0–1, checked against the shared `Stroke` schema and committed to a Zustand store with undo/redo history. The eraser draws with `blendMode="clear"` inside a Skia layer.
