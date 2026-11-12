import { DEFAULT_GAME_SETTINGS } from '@doodle/shared';
import { describe, expect, it } from 'vitest';
import { GameError } from '../lib/errors.js';
import { createMemoryRoomRepository } from '../repositories/memory-room.repository.js';
import { createRoomService } from './room.service.js';
import type { Identity } from './room-state.js';

const person = (n: number): Identity => ({
  userId: `00000000-0000-4000-8000-00000000000${n}`,
  displayName: `Player ${n}`,
  avatarUrl: null,
});

const setup = () => {
  const repository = createMemoryRoomRepository();
  let next = 0;
  const service = createRoomService({
    rooms: repository,
    generateCode: () => `ROOM0${(next += 1)}`,
    now: () => 1_000,
  });
  return { repository, service };
};

const expectGameError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(GameError);
  await expect(promise).rejects.toMatchObject({ code });
};

describe('room service', () => {
  it('creates a lobby with the host as the only player and merged settings', async () => {
    const { service } = setup();
    const room = await service.create(person(1), { rounds: 5 });

    expect(room.phase).toBe('lobby');
    expect(room.hostId).toBe(person(1).userId);
    expect(room.players.map((player) => player.userId)).toEqual([person(1).userId]);
    expect(room.settings).toEqual({ ...DEFAULT_GAME_SETTINGS, rounds: 5 });
  });

  it('retries when a generated code is already taken', async () => {
    const repository = createMemoryRoomRepository();
    const codes = ['SAME01', 'SAME01', 'OTHER1'];
    const service = createRoomService({ rooms: repository, generateCode: () => codes.shift()! });

    const first = await service.create(person(1), {});
    const second = await service.create(person(2), {});
    expect([first.code, second.code]).toEqual(['SAME01', 'OTHER1']);
  });

  it('adds new players and treats a rejoin as a reconnect', async () => {
    const { service } = setup();
    const { code } = await service.create(person(1), {});

    const joined = await service.join(person(2), code);
    expect(joined.isNewPlayer).toBe(true);
    expect(joined.room.players).toHaveLength(2);

    await service.disconnect(person(2).userId, code);
    const rejoined = await service.join(person(2), code);
    expect(rejoined.isNewPlayer).toBe(false);
    expect(rejoined.room.players).toHaveLength(2);
    expect(rejoined.room.players[1]?.isConnected).toBe(true);
  });

  it('rejects joining a missing room', async () => {
    const { service } = setup();
    await expectGameError(service.join(person(1), 'NOPE00'), 'ROOM_NOT_FOUND');
  });

  it('never lets concurrent joins exceed max players', async () => {
    const { service } = setup();
    const { code } = await service.create(person(1), { maxPlayers: 3 });

    const results = await Promise.allSettled(
      [2, 3, 4, 5, 6].map((n) => service.join(person(n), code)),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(
      results.filter(
        (result) =>
          result.status === 'rejected' && (result.reason as GameError).code === 'ROOM_FULL',
      ),
    ).toHaveLength(3);
  });

  it('hands the host role to another player when the host leaves', async () => {
    const { service } = setup();
    const { code } = await service.create(person(1), {});
    await service.join(person(2), code);

    const { room, hostChanged } = await service.leave(person(1).userId, code);
    expect(hostChanged).toBe(true);
    expect(room?.hostId).toBe(person(2).userId);
  });

  it('deletes the room when the last player leaves', async () => {
    const { service, repository } = setup();
    const { code } = await service.create(person(1), {});

    const { room } = await service.leave(person(1).userId, code);
    expect(room).toBeNull();
    expect(await repository.get(code)).toBeNull();
  });

  it('only lets the host change settings and keeps unspecified fields', async () => {
    const { service } = setup();
    const { code } = await service.create(person(1), { drawTimeS: 120 });
    await service.join(person(2), code);

    await expectGameError(
      service.updateSettings(person(2).userId, code, { rounds: 2 }),
      'NOT_HOST',
    );

    const room = await service.updateSettings(person(1).userId, code, { rounds: 2 });
    expect(room.settings).toEqual({ ...DEFAULT_GAME_SETTINGS, drawTimeS: 120, rounds: 2 });
  });

  it('refuses to shrink max players below the current head count', async () => {
    const { service } = setup();
    const { code } = await service.create(person(1), {});
    await service.join(person(2), code);
    await service.join(person(3), code);

    await expectGameError(
      service.updateSettings(person(1).userId, code, { maxPlayers: 2 }),
      'VALIDATION',
    );
  });

  it('lets the host kick other players but not themselves', async () => {
    const { service } = setup();
    const { code } = await service.create(person(1), {});
    await service.join(person(2), code);

    await expectGameError(service.kick(person(2).userId, code, person(1).userId), 'NOT_HOST');
    await expectGameError(service.kick(person(1).userId, code, person(1).userId), 'VALIDATION');

    const room = await service.kick(person(1).userId, code, person(2).userId);
    expect(room.players.map((player) => player.userId)).toEqual([person(1).userId]);
  });
});
