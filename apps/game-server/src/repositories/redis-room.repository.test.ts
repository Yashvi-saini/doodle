import { DEFAULT_GAME_SETTINGS } from '@doodle/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type GameError } from '../lib/errors.js';
import { addPlayer, newRoom } from '../services/room-state.js';
import { createRedisRoomRepository } from './redis-room.repository.js';

const url = process.env.TEST_REDIS_URL;

describe.skipIf(!url)('redis room repository', () => {
  let redis: Redis;
  const code = `T${Date.now().toString(36).toUpperCase().slice(-5)}`;

  beforeAll(() => {
    redis = new Redis(url as string);
  });

  afterAll(async () => {
    await redis.del(`room:${code}`, `lock:room:${code}`);
    await redis.quit();
  });

  it('creates, reads and refuses duplicate codes', async () => {
    const repository = createRedisRoomRepository(redis, { ttlSeconds: 60 });
    const host = {
      userId: '00000000-0000-4000-8000-000000000001',
      displayName: 'H',
      avatarUrl: null,
    };
    const room = newRoom(code, host, { ...DEFAULT_GAME_SETTINGS, maxPlayers: 4 }, Date.now());

    expect(await repository.create(room)).toBe(true);
    expect(await repository.create(room)).toBe(false);
    expect((await repository.get(code))?.hostId).toBe(host.userId);
    expect(await redis.ttl(`room:${code}`)).toBeGreaterThan(0);
  });

  it('serialises concurrent updates so the room never overfills', async () => {
    const repository = createRedisRoomRepository(redis, { ttlSeconds: 60 });

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        repository.update(code, (room) =>
          addPlayer(room, {
            userId: `00000000-0000-4000-8000-0000000001${index}0`,
            displayName: `P${index}`,
            avatarUrl: null,
          }),
        ),
      ),
    );

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const full = results.filter(
      (result) => result.status === 'rejected' && (result.reason as GameError).code === 'ROOM_FULL',
    );
    expect(fulfilled).toHaveLength(3);
    expect(full).toHaveLength(5);
    expect((await repository.get(code))?.players).toHaveLength(4);
  });

  it('deletes the room when a mutation returns null', async () => {
    const repository = createRedisRoomRepository(redis, { ttlSeconds: 60 });
    await repository.update(code, () => null);
    expect(await repository.get(code)).toBeNull();
  });
});
