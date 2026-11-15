import {
  type AckResult,
  type ChatMessage,
  type ClientToServerEvents,
  type GameSettingsPatch,
  type LeaderboardEntry,
  type Player,
  type RoomSnapshot,
  type ScoreDelta,
  type ServerToClientEvents,
  type Stroke,
  type TurnEndReason,
} from '@doodle/shared';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { uuidV4 } from '../../../lib/uuid';
import { SERVER_URL } from '../lib/server-url';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface TurnResult {
  word: string;
  reason: TurnEndReason;
  scores: ScoreDelta[];
}

export interface GameState {
  userId: string;
  name: string;
  connection: 'offline' | 'connecting' | 'online' | 'reconnecting';
  /** The first connection is slow, most likely because the free server is waking up. */
  waking: boolean;
  error: string | null;

  room: RoomSnapshot | null;
  /** Strokes the drawer is still drawing, keyed by stroke id. */
  live: Record<string, Stroke>;
  totalRounds: number;
  /** The secret word, only known by the drawer (and everyone once the turn ends). */
  word: string | null;
  wordChoices: string[] | null;
  turnResult: TurnResult | null;
  leaderboard: LeaderboardEntry[] | null;
  messages: ChatMessage[];
}

const MAX_MESSAGES = 80;

const initialRoomState = {
  room: null,
  live: {},
  totalRounds: 0,
  word: null,
  wordChoices: null,
  turnResult: null,
  leaderboard: null,
  messages: [],
} satisfies Partial<GameState>;

let socket: GameSocket | null = null;

export const useGameStore = create<GameState>()(() => ({
  userId: uuidV4(),
  name: '',
  connection: 'offline',
  waking: false,
  error: null,
  ...initialRoomState,
}));

const set = useGameStore.setState;
const get = useGameStore.getState;

function updateRoom(mutate: (room: RoomSnapshot) => RoomSnapshot) {
  const { room } = get();
  if (room) set({ room: mutate(room) });
}

function updatePlayers(mutate: (players: Player[]) => Player[]) {
  updateRoom((room) => ({ ...room, players: mutate(room.players) }));
}

function systemMessage(text: string, kind: ChatMessage['kind'] = 'system') {
  pushMessage({ id: uuidV4(), kind, userId: null, text, sentAt: Date.now() });
}

function pushMessage(message: ChatMessage) {
  set({ messages: [...get().messages, message].slice(-MAX_MESSAGES) });
}

export function playerName(userId: string | null | undefined): string {
  if (!userId) return 'Someone';
  return get().room?.players.find((player) => player.userId === userId)?.displayName ?? 'Someone';
}

function bindEvents(client: GameSocket) {
  client.on('connect', () => {
    set({ connection: 'online', error: null });
    // After a dropped connection, rejoin the room to get a fresh snapshot.
    const code = get().room?.code;
    if (code) {
      client.emit('room:join', { code }, (result) => {
        if (result.ok) set({ room: result.data, live: {} });
        else leaveLocally(result.error.message);
      });
    }
  });
  client.io.on('reconnect_attempt', () => set({ connection: 'reconnecting' }));
  // Socket.IO keeps retrying on its own; waitForConnection decides when to give up.
  client.on('connect_error', () => {
    set({ connection: get().room ? 'reconnecting' : 'connecting' });
  });

  client.on('room:state', (room) => set({ room, live: {} }));
  client.on('room:player_joined', (player) => {
    updatePlayers((players) => [...players.filter((p) => p.userId !== player.userId), player]);
    systemMessage(`${player.displayName} joined`);
  });
  client.on('room:player_left', ({ userId }) => {
    const name = playerName(userId);
    updatePlayers((players) => players.filter((player) => player.userId !== userId));
    systemMessage(`${name} left`);
  });
  client.on('room:player_updated', (player) =>
    updatePlayers((players) => players.map((p) => (p.userId === player.userId ? player : p))),
  );
  client.on('room:host_changed', ({ userId }) =>
    updateRoom((room) => ({ ...room, hostId: userId })),
  );
  client.on('room:settings_updated', (settings) => updateRoom((room) => ({ ...room, settings })));
  client.on('room:kicked', ({ reason }) => leaveLocally(reason));

  client.on('game:started', ({ totalRounds }) => {
    set({ totalRounds, leaderboard: null, turnResult: null, messages: [] });
    systemMessage('Game started. Good luck!');
  });
  client.on('game:ended', ({ leaderboard }) => {
    set({ leaderboard, word: null, wordChoices: null, live: {} });
    updateRoom((room) => ({ ...room, phase: 'game_end', drawerId: null, turnEndsAt: null }));
  });

  client.on('turn:choosing', ({ drawerId, round, turn, endsAt }) => {
    set({ word: null, wordChoices: null, turnResult: null, live: {} });
    updateRoom((room) => ({
      ...room,
      phase: 'choosing',
      drawerId,
      round,
      turn,
      turnEndsAt: endsAt,
      hint: null,
      strokes: [],
      players: room.players.map((player) => ({ ...player, hasGuessed: false })),
    }));
    systemMessage(`${playerName(drawerId)} is choosing a word`);
  });
  client.on('turn:word_choices', ({ words }) => set({ wordChoices: words }));
  client.on('turn:started', ({ drawerId, hint, round, turn, endsAt }) => {
    set({ wordChoices: null, live: {} });
    updateRoom((room) => ({
      ...room,
      phase: 'drawing',
      drawerId,
      hint,
      round,
      turn,
      turnEndsAt: endsAt,
      strokes: [],
    }));
    systemMessage(`${playerName(drawerId)} is drawing now`);
  });
  client.on('turn:word', ({ word }) => set({ word }));
  client.on('turn:hint', ({ hint }) => updateRoom((room) => ({ ...room, hint })));
  client.on('turn:ended', (result) => {
    set({ turnResult: result, wordChoices: null, live: {} });
    updateRoom((room) => ({ ...room, phase: 'turn_end', hint: result.word, turnEndsAt: null }));
    if (result.word) systemMessage(`The word was "${result.word}"`);
  });

  client.on('draw:stroke_start', ({ strokeId, style, point }) =>
    set({ live: { ...get().live, [strokeId]: { ...style, id: strokeId, points: [point] } } }),
  );
  client.on('draw:stroke_points', ({ strokeId, points }) => {
    const stroke = get().live[strokeId];
    if (!stroke) return;
    set({
      live: { ...get().live, [strokeId]: { ...stroke, points: [...stroke.points, ...points] } },
    });
  });
  client.on('draw:stroke_end', ({ strokeId }) => {
    const { [strokeId]: stroke, ...live } = get().live;
    set({ live });
    if (stroke) updateRoom((room) => ({ ...room, strokes: [...room.strokes, stroke] }));
  });
  client.on('draw:undo', ({ strokeId }) =>
    updateRoom((room) => ({ ...room, strokes: room.strokes.filter((s) => s.id !== strokeId) })),
  );
  client.on('draw:clear', () => {
    set({ live: {} });
    updateRoom((room) => ({ ...room, strokes: [] }));
  });

  client.on('chat:message', pushMessage);
  client.on('chat:correct_guess', ({ userId, points }) => {
    const isMe = userId === get().userId;
    systemMessage(
      isMe ? `You guessed it! +${points}` : `${playerName(userId)} guessed the word!`,
      'system',
    );
  });
}

function leaveLocally(reason?: string) {
  set({ ...initialRoomState, error: reason ?? null });
}

/** A sleeping free-tier server takes up to about a minute to wake on the first request. */
const CONNECT_TIMEOUT_MS = 75_000;
const SLOW_CONNECT_MS = 4_000;

function connect(): GameSocket {
  const { userId, name } = get();
  if (socket?.connected) return socket;
  socket?.removeAllListeners();
  socket?.disconnect();

  set({ connection: 'connecting', error: null });
  const client: GameSocket = io(SERVER_URL, {
    auth: { token: `dev:${userId}:${name.trim()}` },
    transports: ['websocket'],
    timeout: 10_000,
  });
  bindEvents(client);
  socket = client;
  return client;
}

function waitForConnection(client: GameSocket): Promise<void> {
  if (client.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const slow = setTimeout(() => set({ waking: true }), SLOW_CONNECT_MS);
    const giveUp = setTimeout(() => {
      cleanup();
      client.disconnect();
      set({ connection: 'offline' });
      reject(new Error("Can't reach the game server. Check your internet and try again."));
    }, CONNECT_TIMEOUT_MS);
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(slow);
      clearTimeout(giveUp);
      client.off('connect', onConnect);
      set({ waking: false });
    };
    client.on('connect', onConnect);
  });
}

function unwrap<T>(result: AckResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

async function withErrors<T>(task: () => Promise<T>): Promise<T | null> {
  try {
    set({ error: null });
    return await task();
  } catch (error) {
    set({ error: error instanceof Error ? error.message : 'Something went wrong' });
    return null;
  }
}

const requireSocket = (): GameSocket => {
  if (!socket) throw new Error('Not connected');
  return socket;
};

export const gameActions = {
  setName: (name: string) => set({ name }),
  clearError: () => set({ error: null }),

  createRoom: () =>
    withErrors(async () => {
      const client = connect();
      await waitForConnection(client);
      const room = unwrap(await client.emitWithAck('room:create', { settings: {} }));
      set({ ...initialRoomState, room });
    }),

  joinRoom: (code: string) =>
    withErrors(async () => {
      const client = connect();
      await waitForConnection(client);
      const room = unwrap(await client.emitWithAck('room:join', { code }));
      set({ ...initialRoomState, room });
    }),

  leaveRoom: () => {
    socket?.emit('room:leave', {});
    leaveLocally();
  },

  startGame: () =>
    withErrors(async () => {
      unwrap(await requireSocket().emitWithAck('game:start', {}));
    }),

  updateSettings: (settings: GameSettingsPatch) =>
    withErrors(async () => {
      const updated = unwrap(
        await requireSocket().emitWithAck('room:update_settings', { settings }),
      );
      updateRoom((room) => ({ ...room, settings: updated }));
    }),

  kick: (userId: string) =>
    withErrors(async () => {
      unwrap(await requireSocket().emitWithAck('room:kick', { userId }));
    }),

  chooseWord: (index: number) =>
    withErrors(async () => {
      set({ wordChoices: null });
      unwrap(await requireSocket().emitWithAck('turn:choose_word', { index }));
    }),

  sendChat: (text: string) => {
    const trimmed = text.trim();
    if (trimmed) socket?.emit('chat:send', { text: trimmed.slice(0, 100) });
  },

  // Drawing (drawer only). The drawer's own strokes are added locally; the server relays them.
  strokeStart: (stroke: Stroke) => {
    const [point, ...rest] = stroke.points;
    if (!point) return;
    const { id, points: _points, ...style } = stroke;
    socket?.emit('draw:stroke_start', { strokeId: id, style, point });
    if (rest.length > 0) gameActions.strokePoints(id, rest);
  },
  strokePoints: (strokeId: string, points: Stroke['points']) => {
    for (let index = 0; index < points.length; index += 64) {
      socket?.emit('draw:stroke_points', { strokeId, points: points.slice(index, index + 64) });
    }
  },
  strokeEnd: (stroke: Stroke) => {
    socket?.emit('draw:stroke_end', { strokeId: stroke.id });
    updateRoom((room) => ({ ...room, strokes: [...room.strokes, stroke] }));
  },
  undo: () => socket?.emit('draw:undo', {}),
  clear: () => socket?.emit('draw:clear', {}),
};
