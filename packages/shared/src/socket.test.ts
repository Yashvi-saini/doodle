import { describe, expect, it } from 'vitest';
import { ackResult } from './common.js';
import { GameSettings, RoomCode } from './game.js';
import { clientEvents, RoomCreatePayload, serverEvents } from './socket.js';

describe('event maps', () => {
  it('uses namespaced event names', () => {
    const names = [...Object.keys(clientEvents), ...Object.keys(serverEvents)];
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+:[a-z_]+$/);
    }
  });

  it('does not use names reserved by Socket.IO', () => {
    const reserved = ['connect', 'connect_error', 'disconnect', 'disconnecting', 'error'];
    for (const name of Object.keys(serverEvents)) {
      expect(reserved).not.toContain(name);
    }
  });
});

describe('RoomCode', () => {
  it('normalises case and whitespace', () => {
    expect(RoomCode.parse(' ab12cd ')).toBe('AB12CD');
  });

  it('rejects codes of the wrong length', () => {
    expect(RoomCode.safeParse('ABC').success).toBe(false);
  });
});

describe('GameSettings', () => {
  it('fills defaults', () => {
    expect(GameSettings.parse({})).toEqual({
      rounds: 3,
      drawTimeS: 80,
      maxPlayers: 8,
      hints: 2,
      packId: null,
      visibility: 'private',
    });
  });

  it('lets room:create omit settings', () => {
    expect(RoomCreatePayload.parse({})).toEqual({ settings: {} });
  });

  it('rejects out-of-range values', () => {
    expect(GameSettings.safeParse({ maxPlayers: 50 }).success).toBe(false);
  });
});

describe('ackResult', () => {
  const schema = ackResult(GameSettings);

  it('parses success results', () => {
    const parsed = schema.parse({ ok: true, data: {} });
    expect(parsed.ok).toBe(true);
  });

  it('parses error results', () => {
    const parsed = schema.parse({
      ok: false,
      error: { code: 'ROOM_FULL', message: 'Room is full' },
    });
    expect(parsed).toEqual({ ok: false, error: { code: 'ROOM_FULL', message: 'Room is full' } });
  });
});
