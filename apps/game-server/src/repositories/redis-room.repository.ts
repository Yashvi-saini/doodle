import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Redis } from 'ioredis';
import { GameError } from '../lib/errors.js';
import type { RoomState } from '../services/room-state.js';
import type { RoomMutation, RoomRepository } from './room.repository.js';

const RELEASE_LOCK = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

const LOCK_TTL_MS = 5_000;
const LOCK_WAIT_MS = 3_000;

const roomKey = (code: string) => `room:${code}`;
const lockKey = (code: string) => `lock:room:${code}`;

export interface RedisRoomRepositoryOptions {
  ttlSeconds: number;
}

export function createRedisRoomRepository(
  redis: Redis,
  { ttlSeconds }: RedisRoomRepositoryOptions,
): RoomRepository {
  async function read(code: string): Promise<RoomState | null> {
    const raw = await redis.get(roomKey(code));
    return raw ? (JSON.parse(raw) as RoomState) : null;
  }

  async function withLock<T>(code: string, work: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const deadline = Date.now() + LOCK_WAIT_MS;
    while ((await redis.set(lockKey(code), token, 'PX', LOCK_TTL_MS, 'NX')) !== 'OK') {
      if (Date.now() > deadline) {
        throw new GameError('RATE_LIMITED', 'Room is busy, please try again');
      }
      await delay(10 + Math.random() * 20);
    }
    try {
      return await work();
    } finally {
      await redis.eval(RELEASE_LOCK, 1, lockKey(code), token);
    }
  }

  return {
    get: read,

    async create(room) {
      const result = await redis.set(
        roomKey(room.code),
        JSON.stringify(room),
        'EX',
        ttlSeconds,
        'NX',
      );
      return result === 'OK';
    },

    update(code, mutate: RoomMutation) {
      return withLock(code, async () => {
        const current = await read(code);
        if (!current) {
          throw new GameError('ROOM_NOT_FOUND', 'Room not found');
        }
        const next = mutate(current);
        if (next === null) {
          await redis.del(roomKey(code));
        } else {
          await redis.set(roomKey(code), JSON.stringify(next), 'EX', ttlSeconds);
        }
        return next;
      });
    },
  };
}
