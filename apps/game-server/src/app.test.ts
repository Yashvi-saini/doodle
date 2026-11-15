import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  ClientToServerEvents,
  RoomSnapshot,
  ServerPayload,
  ServerToClientEvents,
} from '@doodle/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGameServer } from './app.js';
import { createDevTokenVerifier } from './auth/token-verifier.js';
import type { GameServer } from './handlers/types.js';
import { createLogger } from './lib/logger.js';
import { createMemoryRoomRepository } from './repositories/memory-room.repository.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

let httpServer: HttpServer;
let io: GameServer;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  httpServer = createServer();
  io = createGameServer(httpServer, {
    config: { CORS_ORIGINS: [] },
    logger: createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
    roomRepository: createMemoryRoomRepository(),
    verifier: createDevTokenVerifier(),
    game: { timings: { chooseMs: 150, turnEndPauseMs: 50 }, drawMsOverride: 300 },
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await io.close();
});

function client(token: string | null): Client {
  const socket: Client = connect(url, {
    auth: token === null ? {} : { token },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  clients.push(socket);
  return socket;
}

async function connected(token: string): Promise<Client> {
  const socket = client(token);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

function next<E extends keyof ServerToClientEvents>(
  socket: Client,
  event: E,
): Promise<ServerPayload<E>> {
  return new Promise((resolve) => {
    (socket as unknown as { once(e: string, l: (p: ServerPayload<E>) => void): void }).once(
      event,
      resolve,
    );
  });
}

function snapshotOf(result: { ok: boolean; data?: unknown }): RoomSnapshot {
  expect(result.ok).toBe(true);
  return result.data as RoomSnapshot;
}

describe('connection', () => {
  it('rejects sockets without a token', async () => {
    const socket = client(null);
    const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(error.message).toBe('UNAUTHORIZED');
  });

  it('rejects sockets with a malformed token', async () => {
    const socket = client('dev:not-a-uuid:Alice');
    const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(error.message).toBe('UNAUTHORIZED');
  });
});

describe('rooms', () => {
  it('creates a room and lets another player join it', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const bob = await connected(`dev:${BOB}:Bob`);

    const created = snapshotOf(await alice.emitWithAck('room:create', { settings: { rounds: 4 } }));
    expect(created.hostId).toBe(ALICE);
    expect(created.settings.rounds).toBe(4);

    const joinedEvent = next(alice, 'room:player_joined');
    const joined = snapshotOf(
      await bob.emitWithAck('room:join', { code: created.code.toLowerCase() }),
    );

    expect(joined.players.map((player) => player.displayName)).toEqual(['Alice', 'Bob']);
    expect((await joinedEvent).userId).toBe(BOB);
  });

  it('returns a VALIDATION error for malformed payloads', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const result = await alice.emitWithAck('room:join', { code: '!!' });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('returns ROOM_NOT_FOUND for unknown rooms', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const result = await alice.emitWithAck('room:join', { code: 'ZZZZZZ' });
    expect(result).toMatchObject({ ok: false, error: { code: 'ROOM_NOT_FOUND' } });
  });

  it('tells the room when a player leaves and reassigns the host', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const bob = await connected(`dev:${BOB}:Bob`);
    const { code } = snapshotOf(await alice.emitWithAck('room:create', { settings: {} }));
    await bob.emitWithAck('room:join', { code });

    const left = next(bob, 'room:player_left');
    const hostChanged = next(bob, 'room:host_changed');
    alice.emit('room:leave', {});

    expect((await left).userId).toBe(ALICE);
    expect((await hostChanged).userId).toBe(BOB);
  });

  it('marks a player as disconnected when their socket drops', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const bob = await connected(`dev:${BOB}:Bob`);
    const { code } = snapshotOf(await alice.emitWithAck('room:create', { settings: {} }));
    await bob.emitWithAck('room:join', { code });

    const updated = next(alice, 'room:player_updated');
    bob.disconnect();

    expect(await updated).toMatchObject({ userId: BOB, isConnected: false });
  });

  it('keeps a player connected when a stale socket drops after they rejoined', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const bob = await connected(`dev:${BOB}:Bob`);
    const { code } = snapshotOf(await alice.emitWithAck('room:create', { settings: {} }));
    await bob.emitWithAck('room:join', { code });

    const bobAgain = await connected(`dev:${BOB}:Bob`);
    await bobAgain.emitWithAck('room:join', { code });
    bob.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { players } = snapshotOf(await alice.emitWithAck('room:join', { code }));
    expect(players.find((player) => player.userId === BOB)).toMatchObject({ isConnected: true });
  });

  it('lets the host kick a player', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const bob = await connected(`dev:${BOB}:Bob`);
    const { code } = snapshotOf(await alice.emitWithAck('room:create', { settings: {} }));
    await bob.emitWithAck('room:join', { code });

    const kicked = next(bob, 'room:kicked');
    const result = await alice.emitWithAck('room:kick', { userId: BOB });

    expect(result.ok).toBe(true);
    expect((await kicked).reason).toMatch(/host/i);
  });
});

describe('game', () => {
  async function twoPlayerRoom() {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const bob = await connected(`dev:${BOB}:Bob`);
    const { code } = snapshotOf(
      await alice.emitWithAck('room:create', { settings: { rounds: 1, hints: 0 } }),
    );
    await bob.emitWithAck('room:join', { code });
    return { alice, bob, code };
  }

  it('refuses to start with a single player', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    await alice.emitWithAck('room:create', { settings: {} });
    const result = await alice.emitWithAck('game:start', {});
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('only lets the host start the game', async () => {
    const { bob } = await twoPlayerRoom();
    const result = await bob.emitWithAck('game:start', {});
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
  });

  it('plays a full game: choose, draw, guess, score and finish', async () => {
    const { alice, bob } = await twoPlayerRoom();

    const choosing = next(bob, 'turn:choosing');
    const choices = next(alice, 'turn:word_choices');
    expect((await alice.emitWithAck('game:start', {})).ok).toBe(true);
    expect((await choosing).drawerId).toBe(ALICE);
    const { words } = await choices;
    expect(words).toHaveLength(3);

    const notDrawer = await bob.emitWithAck('turn:choose_word', { index: 0 });
    expect(notDrawer).toMatchObject({ ok: false, error: { code: 'NOT_DRAWER' } });

    const started = next(bob, 'turn:started');
    const secret = next(alice, 'turn:word');
    expect((await alice.emitWithAck('turn:choose_word', { index: 1 })).ok).toBe(true);
    const word = words[1]!;
    expect((await secret).word).toBe(word);
    expect((await started).hint).toMatch(/^[_ -]+$/);

    // Strokes are relayed to the guesser.
    const relayed = next(bob, 'draw:stroke_end');
    alice.emit('draw:stroke_start', {
      strokeId: 's1',
      style: { tool: 'brush', color: '#000000', size: 0.01 },
      point: [0.1, 0.1],
    });
    alice.emit('draw:stroke_points', { strokeId: 's1', points: [[0.2, 0.2]] });
    alice.emit('draw:stroke_end', { strokeId: 's1' });
    expect((await relayed).strokeId).toBe('s1');

    // A wrong guess is broadcast as chat; the right one scores and ends the turn.
    const chat = next(alice, 'chat:message');
    bob.emit('chat:send', { text: 'definitely not it' });
    expect((await chat).text).toBe('definitely not it');

    const correct = next(alice, 'chat:correct_guess');
    const ended = next(bob, 'turn:ended');
    bob.emit('chat:send', { text: word.toUpperCase() });
    expect((await correct).userId).toBe(BOB);
    const turnEnd = await ended;
    expect(turnEnd).toMatchObject({ word, reason: 'all_guessed' });
    expect(turnEnd.scores.find((score) => score.userId === BOB)?.points).toBeGreaterThan(0);

    // Bob draws next; when his word choice times out, one is picked for him.
    expect((await next(alice, 'turn:choosing')).drawerId).toBe(BOB);
    expect((await next(alice, 'turn:ended')).reason).toBe('time_up');

    const gameEnded = await next(alice, 'game:ended');
    expect(gameEnded.leaderboard[0]).toMatchObject({ userId: BOB, rank: 1 });
  });

  it('rejects drawing from anyone but the drawer', async () => {
    const { alice, bob } = await twoPlayerRoom();
    const choices = next(alice, 'turn:word_choices');
    await alice.emitWithAck('game:start', {});
    await choices;
    await alice.emitWithAck('turn:choose_word', { index: 0 });

    const error = next(bob, 'server:error');
    bob.emit('draw:clear', {});
    expect((await error).code).toBe('NOT_DRAWER');
  });

  it('ends the turn when the drawer leaves', async () => {
    const { alice, bob, code } = await twoPlayerRoom();
    const carol = await connected('dev:33333333-3333-4333-8333-333333333333:Carol');
    await carol.emitWithAck('room:join', { code });

    const choices = next(alice, 'turn:word_choices');
    await alice.emitWithAck('game:start', {});
    await choices;

    const ended = next(bob, 'turn:ended');
    alice.emit('room:leave', {});
    expect((await ended).reason).toBe('drawer_left');
  });
});
