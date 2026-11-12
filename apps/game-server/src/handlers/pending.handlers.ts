import type { ClientEventName } from '@doodle/shared';
import { GameError } from '../lib/errors.js';
import { handle } from './handle.js';
import type { HandlerContext } from './types.js';

const PENDING_EVENTS = [
  'game:start',
  'turn:choose_word',
  'draw:stroke_start',
  'draw:stroke_points',
  'draw:stroke_end',
  'draw:undo',
  'draw:clear',
  'chat:send',
] as const satisfies readonly ClientEventName[];

export function registerPendingHandlers({ socket, logger }: HandlerContext): void {
  for (const event of PENDING_EVENTS) {
    handle(socket, logger, event, () =>
      Promise.reject(new GameError('NOT_IMPLEMENTED', `${event} is not implemented yet`)),
    );
  }
}
