import { DisplayName, UserId } from '@doodle/shared';
import { GameError } from '../lib/errors.js';
import type { Identity } from '../services/room-state.js';

export interface TokenVerifier {
  verify(token: string): Promise<Identity>;
}

export function createDevTokenVerifier(): TokenVerifier {
  return {
    verify(token) {
      const [scheme, userId, ...nameParts] = token.split(':');
      const id = UserId.safeParse(userId);
      const name = DisplayName.safeParse(nameParts.join(':'));
      if (scheme !== 'dev' || !id.success || !name.success) {
        return Promise.reject(new GameError('UNAUTHORIZED', 'Invalid dev token'));
      }
      return Promise.resolve({ userId: id.data, displayName: name.data, avatarUrl: null });
    },
  };
}

export function createRejectingTokenVerifier(): TokenVerifier {
  return {
    verify: () => Promise.reject(new GameError('UNAUTHORIZED', 'Authentication not configured')),
  };
}
