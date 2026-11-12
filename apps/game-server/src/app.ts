import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { TokenVerifier } from './auth/token-verifier.js';
import type { GameServerConfig } from './config/env.js';
import { authMiddleware } from './handlers/auth.middleware.js';
import { registerPendingHandlers } from './handlers/pending.handlers.js';
import { registerRoomHandlers } from './handlers/room.handlers.js';
import { type GameServer, userChannel } from './handlers/types.js';
import type { Logger } from './lib/logger.js';
import type { RoomRepository } from './repositories/room.repository.js';
import { createRoomService } from './services/room.service.js';

export interface GameServerDeps {
  config: Pick<GameServerConfig, 'CORS_ORIGINS'>;
  logger: Logger;
  roomRepository: RoomRepository;
  verifier: TokenVerifier;
}

export function createGameServer(httpServer: HttpServer, deps: GameServerDeps): GameServer {
  const { config, logger, roomRepository, verifier } = deps;

  const io: GameServer = new Server(httpServer, {
    serveClient: false,
    maxHttpBufferSize: 64 * 1024,
    cors: { origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false },
  });

  const rooms = createRoomService({ rooms: roomRepository });

  io.use(authMiddleware(verifier, logger));

  io.on('connection', (socket) => {
    const { userId } = socket.data.user;
    logger.debug({ userId, socketId: socket.id }, 'socket connected');
    void socket.join(userChannel(userId));

    const context = { io, socket, rooms, logger };
    registerRoomHandlers(context);
    registerPendingHandlers(context);
  });

  return io;
}
