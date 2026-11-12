import { SocketAuth } from '@doodle/shared';
import type { TokenVerifier } from '../auth/token-verifier.js';
import type { Logger } from '../lib/logger.js';
import type { GameSocket } from './types.js';

class UnauthorizedError extends Error {
  readonly data = { code: 'UNAUTHORIZED' as const };

  constructor() {
    super('UNAUTHORIZED');
  }
}

export function authMiddleware(verifier: TokenVerifier, logger: Logger) {
  return (socket: GameSocket, next: (error?: Error) => void) => {
    const auth = SocketAuth.safeParse(socket.handshake.auth);
    if (!auth.success) {
      next(new UnauthorizedError());
      return;
    }
    verifier.verify(auth.data.token).then(
      (identity) => {
        socket.data.user = identity;
        socket.data.roomCode = null;
        next();
      },
      (error: unknown) => {
        logger.debug({ err: error }, 'socket authentication failed');
        next(new UnauthorizedError());
      },
    );
  };
}
