import { GameError } from '../lib/errors.js';
import { findPlayer, toSnapshot } from '../services/room-state.js';
import { handle } from './handle.js';
import { type HandlerContext, userChannel } from './types.js';

export function registerRoomHandlers({ io, socket, rooms, logger }: HandlerContext): void {
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
  };

  handle(socket, logger, 'room:create', async ({ settings }) => {
    await leaveCurrentRoom();
    const room = await rooms.create(user, settings);
    await socket.join(room.code);
    socket.data.roomCode = room.code;
    return toSnapshot(room);
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
    return toSnapshot(room);
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
    return {};
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    rooms
      .disconnect(user.userId, code)
      .then((room) => {
        const player = room && findPlayer(room, user.userId);
        if (player) {
          io.to(code).emit('room:player_updated', player);
        }
      })
      .catch((error: unknown) => logger.error({ err: error, code }, 'disconnect cleanup failed'));
  });
}
