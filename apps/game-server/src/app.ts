import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { TokenVerifier } from './auth/token-verifier.js';
import type { GameServerConfig } from './config/env.js';
import { authMiddleware } from './handlers/auth.middleware.js';
import { registerGameHandlers } from './handlers/game.handlers.js';
import { registerRoomHandlers } from './handlers/room.handlers.js';
import { type GameServer, userChannel } from './handlers/types.js';
import type { Logger } from './lib/logger.js';
import type { RoomRepository } from './repositories/room.repository.js';
import {
  createGameService,
  type GameEmitter,
  type GameServiceDeps,
} from './services/game.service.js';
import { createRoomService } from './services/room.service.js';

export interface GameServerDeps {
  config: Pick<GameServerConfig, 'CORS_ORIGINS'>;
  logger: Logger;
  roomRepository: RoomRepository;
  verifier: TokenVerifier;
  /** Timing overrides, for tests. */
  game?: Pick<GameServiceDeps, 'timings' | 'drawMsOverride'>;
}

export function createGameServer(httpServer: HttpServer, deps: GameServerDeps): GameServer {
  const { config, logger, roomRepository, verifier } = deps;

  const io: GameServer = new Server(httpServer, {
    serveClient: false,
    maxHttpBufferSize: 64 * 1024,
    cors: { origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false },
  });

  const rooms = createRoomService({ rooms: roomRepository });

  type UntypedEmitter = { emit(event: string, payload: unknown): void };
  const emit: GameEmitter = {
    toRoom: (code, event, payload) => (io.to(code) as UntypedEmitter).emit(event, payload),
    toUser: (userId, event, payload) =>
      (io.to(userChannel(userId)) as UntypedEmitter).emit(event, payload),
  };
  const game = createGameService({ rooms: roomRepository, emit, logger, ...deps.game });
  httpServer.on('close', () => game.close());

  io.use(authMiddleware(verifier, logger));

  io.on('connection', (socket) => {
    const { userId } = socket.data.user;
    logger.debug({ userId, socketId: socket.id }, 'socket connected');
    void socket.join(userChannel(userId));

    const context = { io, socket, rooms, game, logger };
    registerRoomHandlers(context);
    registerGameHandlers(context);
  });

  return io;
}
