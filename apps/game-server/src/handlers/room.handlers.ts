import { GameError } from '../lib/errors.js';
import { findPlayer } from '../services/room-state.js';
import { handle } from './handle.js';
import { type HandlerContext, userChannel } from './types.js';

export function registerRoomHandlers({ io, socket, rooms, game, logger }: HandlerContext): void {
  const user = socket.data.user;

  const currentRoom = (): string => {
    const code = socket.data.roomCode;
    if (!code) {
      throw new GameError('ROOM_NOT_FOUND', 'You are not in a room');
    }
    return code;
  };

  const leaveCurrentRoom = async () => {
    const code = socket.data.roomCode;
    if (!code) return;
    socket.data.roomCode = null;
    await socket.leave(code);
    const { room, hostChanged } = await rooms.leave(user.userId, code);
    io.to(code).emit('room:player_left', { userId: user.userId });
    if (room && hostChanged) {
      io.to(code).emit('room:host_changed', { userId: room.hostId });
    }
    await game.playerGone(code, user.userId);
  };

  handle(socket, logger, 'room:create', async ({ settings }) => {
    await leaveCurrentRoom();
    const room = await rooms.create(user, settings);
    await socket.join(room.code);
    socket.data.roomCode = room.code;
    return game.snapshot(room);
  });

  handle(socket, logger, 'room:join', async ({ code }) => {
    if (socket.data.roomCode !== code) {
      await leaveCurrentRoom();
    }
    const { room, isNewPlayer } = await rooms.join(user, code);
    await socket.join(code);
    socket.data.roomCode = code;

    const player = findPlayer(room, user.userId);
    if (player) {
      socket.to(code).emit(isNewPlayer ? 'room:player_joined' : 'room:player_updated', player);
    }
    game.resendPrivateState(room, user.userId);
    return game.snapshot(room);
  });

  handle(socket, logger, 'room:leave', async () => {
    await leaveCurrentRoom();
  });

  handle(socket, logger, 'room:update_settings', async ({ settings }) => {
    const code = currentRoom();
    const room = await rooms.updateSettings(user.userId, code, settings);
    socket.to(code).emit('room:settings_updated', room.settings);
    return room.settings;
  });

  handle(socket, logger, 'room:kick', async ({ userId }) => {
    const code = currentRoom();
    await rooms.kick(user.userId, code, userId);
    io.to(userChannel(userId)).emit('room:kicked', { reason: 'Removed by the host' });
    io.in(userChannel(userId)).socketsLeave(code);
    io.to(code).emit('room:player_left', { userId });
    await game.playerGone(code, userId);
    return {};
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    void (async () => {
      // A dropped connection is often noticed only after the client has already
      // rejoined on a new socket. The player is still here in that case.
      const siblings = await io.in(userChannel(user.userId)).fetchSockets();
      if (siblings.some((other) => other.id !== socket.id && other.rooms.has(code))) return;
      const room = await rooms.disconnect(user.userId, code);
      const player = room && findPlayer(room, user.userId);
      if (player) {
        io.to(code).emit('room:player_updated', player);
      }
      await game.playerGone(code, user.userId);
    })().catch((error: unknown) => logger.error({ err: error, code }, 'disconnect cleanup failed'));
  });
}
