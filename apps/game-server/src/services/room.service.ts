import { randomInt } from 'node:crypto';
import { DEFAULT_GAME_SETTINGS, type GameSettingsPatch } from '@doodle/shared';
import { GameError } from '../lib/errors.js';
import type { RoomRepository } from '../repositories/room.repository.js';
import {
  addPlayer,
  assertHost,
  findPlayer,
  type Identity,
  newRoom,
  removePlayer,
  type RoomState,
  setConnected,
} from './room-state.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = '';
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export interface RoomServiceDeps {
  rooms: RoomRepository;
  now?: () => number;
  generateCode?: () => string;
}

export interface JoinResult {
  room: RoomState;
  isNewPlayer: boolean;
}

export interface LeaveResult {
  room: RoomState | null;
  hostChanged: boolean;
}

export type RoomService = ReturnType<typeof createRoomService>;

export function createRoomService({
  rooms,
  now = Date.now,
  generateCode = generateRoomCode,
}: RoomServiceDeps) {
  async function mustUpdate(code: string, mutate: (room: RoomState) => RoomState) {
    const room = await rooms.update(code, mutate);
    if (!room) {
      throw new GameError('ROOM_NOT_FOUND', 'Room not found');
    }
    return room;
  }

  return {
    async create(host: Identity, patch: GameSettingsPatch): Promise<RoomState> {
      const settings = { ...DEFAULT_GAME_SETTINGS, ...patch };
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const room = newRoom(generateCode(), host, settings, now());
        if (await rooms.create(room)) {
          return room;
        }
      }
      throw new GameError('INTERNAL', 'Could not allocate a room code');
    },

    async join(identity: Identity, code: string): Promise<JoinResult> {
      const outcome = { isNewPlayer: false };
      const room = await mustUpdate(code, (current) => {
        outcome.isNewPlayer = !findPlayer(current, identity.userId);
        return addPlayer(current, identity);
      });
      return { room, isNewPlayer: outcome.isNewPlayer };
    },

    async leave(userId: string, code: string): Promise<LeaveResult> {
      const outcome = { previousHostId: '' };
      try {
        const room = await rooms.update(code, (current) => {
          outcome.previousHostId = current.hostId;
          return findPlayer(current, userId) ? removePlayer(current, userId) : current;
        });
        return { room, hostChanged: room !== null && room.hostId !== outcome.previousHostId };
      } catch (error) {
        if (error instanceof GameError && error.code === 'ROOM_NOT_FOUND') {
          return { room: null, hostChanged: false };
        }
        throw error;
      }
    },

    async disconnect(userId: string, code: string): Promise<RoomState | null> {
      try {
        return await rooms.update(code, (current) =>
          findPlayer(current, userId) ? setConnected(current, userId, false) : current,
        );
      } catch (error) {
        if (error instanceof GameError && error.code === 'ROOM_NOT_FOUND') {
          return null;
        }
        throw error;
      }
    },

    updateSettings(userId: string, code: string, patch: GameSettingsPatch): Promise<RoomState> {
      return mustUpdate(code, (current) => {
        assertHost(current, userId);
        if (current.phase !== 'lobby' && current.phase !== 'game_end') {
          throw new GameError('GAME_IN_PROGRESS', 'Settings can only change in the lobby');
        }
        const settings = { ...current.settings, ...patch };
        if (settings.maxPlayers < current.players.length) {
          throw new GameError(
            'VALIDATION',
            'Max players is below the number of players in the room',
          );
        }
        return { ...current, settings };
      });
    },

    kick(hostId: string, code: string, targetId: string): Promise<RoomState> {
      return mustUpdate(code, (current) => {
        assertHost(current, hostId);
        if (targetId === hostId) {
          throw new GameError('VALIDATION', 'The host cannot kick themselves');
        }
        if (!findPlayer(current, targetId)) {
          throw new GameError('NOT_FOUND', 'Player is not in this room');
        }
        const next = removePlayer(current, targetId);
        if (!next) {
          throw new GameError('INTERNAL', 'Room unexpectedly empty');
        }
        return next;
      });
    },
  };
}
