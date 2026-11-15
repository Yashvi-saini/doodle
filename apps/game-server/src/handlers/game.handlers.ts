import { GameError } from '../lib/errors.js';
import { handle } from './handle.js';
import type { HandlerContext } from './types.js';

export function registerGameHandlers({ socket, game, logger }: HandlerContext): void {
  const user = socket.data.user;

  const currentRoom = (): string => {
    const code = socket.data.roomCode;
    if (!code) throw new GameError('ROOM_NOT_FOUND', 'You are not in a room');
    return code;
  };

  handle(socket, logger, 'game:start', async () => {
    await game.start(user.userId, currentRoom());
    return {};
  });

  handle(socket, logger, 'turn:choose_word', async ({ index }) => {
    await game.chooseWord(user.userId, currentRoom(), index);
    return {};
  });

  // Drawing events are applied in memory, synchronously and in arrival order, then relayed.
  handle(socket, logger, 'draw:stroke_start', (payload) => {
    const code = currentRoom();
    game.strokeStart(code, user.userId, payload);
    socket.to(code).emit('draw:stroke_start', payload);
    return Promise.resolve();
  });

  handle(socket, logger, 'draw:stroke_points', (payload) => {
    const code = currentRoom();
    game.strokePoints(code, user.userId, payload);
    socket.to(code).emit('draw:stroke_points', payload);
    return Promise.resolve();
  });

  handle(socket, logger, 'draw:stroke_end', (payload) => {
    const code = currentRoom();
    game.strokeEnd(code, user.userId, payload);
    socket.to(code).emit('draw:stroke_end', payload);
    return Promise.resolve();
  });

  handle(socket, logger, 'draw:undo', () => {
    const code = currentRoom();
    const strokeId = game.undo(code, user.userId);
    if (strokeId) socket.nsp.to(code).emit('draw:undo', { strokeId });
    return Promise.resolve();
  });

  handle(socket, logger, 'draw:clear', () => {
    const code = currentRoom();
    game.clear(code, user.userId);
    socket.nsp.to(code).emit('draw:clear', {});
    return Promise.resolve();
  });

  handle(socket, logger, 'chat:send', async ({ text }) => {
    await game.chat(user.userId, currentRoom(), text);
  });
}
