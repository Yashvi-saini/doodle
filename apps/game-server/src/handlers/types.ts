import type { ClientToServerEvents, ServerToClientEvents } from '@doodle/shared';
import type { Server, Socket } from 'socket.io';
import type { Logger } from '../lib/logger.js';
import type { RoomService } from '../services/room.service.js';
import type { Identity } from '../services/room-state.js';

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  user: Identity;
  roomCode: string | null;
}

export type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export interface HandlerContext {
  io: GameServer;
  socket: GameSocket;
  rooms: RoomService;
  logger: Logger;
}

export const userChannel = (userId: string) => `user:${userId}`;
