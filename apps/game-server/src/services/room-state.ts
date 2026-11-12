import type { GameSettings, Player, RoomSnapshot, Stroke } from '@doodle/shared';
import { GameError } from '../lib/errors.js';

export interface Identity {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface RoomState extends RoomSnapshot {
  word: string | null;
  createdAt: number;
}

export function newRoom(
  code: string,
  host: Identity,
  settings: GameSettings,
  now: number,
): RoomState {
  return {
    code,
    hostId: host.userId,
    settings,
    phase: 'lobby',
    players: [newPlayer(host)],
    round: 0,
    turn: 0,
    drawerId: null,
    hint: null,
    turnEndsAt: null,
    strokes: [] as Stroke[],
    word: null,
    createdAt: now,
  };
}

export function newPlayer(identity: Identity): Player {
  return {
    userId: identity.userId,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
    score: 0,
    isConnected: true,
    hasGuessed: false,
  };
}

export function toSnapshot(room: RoomState): RoomSnapshot {
  const { word: _word, createdAt: _createdAt, ...snapshot } = room;
  return snapshot;
}

export function findPlayer(room: RoomState, userId: string): Player | undefined {
  return room.players.find((player) => player.userId === userId);
}

export function addPlayer(room: RoomState, identity: Identity): RoomState {
  const existing = findPlayer(room, identity.userId);
  if (existing) {
    return {
      ...room,
      players: room.players.map((player) =>
        player.userId === identity.userId
          ? { ...player, displayName: identity.displayName, isConnected: true }
          : player,
      ),
    };
  }
  if (room.players.length >= room.settings.maxPlayers) {
    throw new GameError('ROOM_FULL', 'This room is full');
  }
  return { ...room, players: [...room.players, newPlayer(identity)] };
}

export function removePlayer(room: RoomState, userId: string): RoomState | null {
  const players = room.players.filter((player) => player.userId !== userId);
  if (players.length === 0) {
    return null;
  }
  const hostId =
    room.hostId === userId
      ? (players.find((player) => player.isConnected) ?? players[0]!).userId
      : room.hostId;
  return { ...room, players, hostId };
}

export function setConnected(room: RoomState, userId: string, isConnected: boolean): RoomState {
  return {
    ...room,
    players: room.players.map((player) =>
      player.userId === userId ? { ...player, isConnected } : player,
    ),
  };
}

export function assertHost(room: RoomState, userId: string): void {
  if (room.hostId !== userId) {
    throw new GameError('NOT_HOST', 'Only the host can do that');
  }
}
