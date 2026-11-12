import { GameError } from '../lib/errors.js';
import type { RoomState } from '../services/room-state.js';
import type { RoomRepository } from './room.repository.js';

export function createMemoryRoomRepository(): RoomRepository {
  const rooms = new Map<string, string>();
  const queues = new Map<string, Promise<unknown>>();

  const read = (code: string): RoomState | null => {
    const raw = rooms.get(code);
    return raw ? (JSON.parse(raw) as RoomState) : null;
  };

  function serialise<T>(code: string, work: () => T): Promise<T> {
    const previous = queues.get(code) ?? Promise.resolve();
    const next = previous.then(work, work);
    queues.set(
      code,
      next.catch(() => undefined),
    );
    return next;
  }

  return {
    get: (code) => Promise.resolve(read(code)),

    create(room) {
      if (rooms.has(room.code)) return Promise.resolve(false);
      rooms.set(room.code, JSON.stringify(room));
      return Promise.resolve(true);
    },

    update(code, mutate) {
      return serialise(code, () => {
        const current = read(code);
        if (!current) {
          throw new GameError('ROOM_NOT_FOUND', 'Room not found');
        }
        const next = mutate(current);
        if (next === null) {
          rooms.delete(code);
        } else {
          rooms.set(code, JSON.stringify(next));
        }
        return next;
      });
    },
  };
}
