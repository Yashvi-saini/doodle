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

describe('events planned for later phases', () => {
  it('acks NOT_IMPLEMENTED for game:start', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const result = await alice.emitWithAck('game:start', {});
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_IMPLEMENTED' } });
  });

  it('emits server:error for events without an ack', async () => {
    const alice = await connected(`dev:${ALICE}:Alice`);
    const error = next(alice, 'server:error');
    alice.emit('chat:send', { text: 'hello' });
    expect((await error).code).toBe('NOT_IMPLEMENTED');
  });
});
