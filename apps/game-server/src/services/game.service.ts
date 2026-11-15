import { randomUUID } from 'node:crypto';
import {
  DRAWING_LIMITS,
  type Player,
  type RoomSnapshot,
  type ServerEventName,
  type ServerPayload,
  type Stroke,
  type StrokeEnd,
  type StrokePoints,
  type StrokeStart,
  type TurnEndReason,
} from '@doodle/shared';
import { GameError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { RoomRepository } from '../repositories/room.repository.js';
import {
  DRAWER_POINTS_PER_GUESS,
  guessPoints,
  isCloseGuess,
  isCorrectGuess,
  leaderboard,
  maskWord,
  maxReveals,
  revealLetter,
} from './game-rules.js';
import { assertHost, findPlayer, type RoomState, toSnapshot } from './room-state.js';
import { pickWords } from './words.js';

export interface GameEmitter {
  toRoom<E extends ServerEventName>(code: string, event: E, payload: ServerPayload<E>): void;
  toUser<E extends ServerEventName>(userId: string, event: E, payload: ServerPayload<E>): void;
}

export interface GameTimings {
  chooseMs: number;
  turnEndPauseMs: number;
}

export const DEFAULT_TIMINGS: GameTimings = { chooseMs: 15_000, turnEndPauseMs: 5_000 };

export interface GameServiceDeps {
  rooms: RoomRepository;
  emit: GameEmitter;
  logger: Logger;
  timings?: GameTimings;
  now?: () => number;
  /** Overrides the turn draw time, for tests. */
  drawMsOverride?: number;
}

/**
 * Per-room state that only lives on this process: timers and the strokes of the current turn.
 * Strokes are kept here rather than in the repository so that a busy drawer doesn't take the
 * room lock dozens of times a second, and so stroke events are applied in the order they arrive.
 */
interface Runtime {
  turn: number;
  drawerId: string | null;
  isDrawing: boolean;
  strokes: Stroke[];
  live: Map<string, Stroke>;
  timers: Set<NodeJS.Timeout>;
}

const ACTIVE_PHASES = new Set(['choosing', 'drawing']);

export type GameService = ReturnType<typeof createGameService>;

export function createGameService({
  rooms,
  emit,
  logger,
  timings = DEFAULT_TIMINGS,
  now = Date.now,
  drawMsOverride,
}: GameServiceDeps) {
  const runtimes = new Map<string, Runtime>();

  const runtime = (code: string): Runtime => {
    let state = runtimes.get(code);
    if (!state) {
      state = {
        turn: 0,
        drawerId: null,
        isDrawing: false,
        strokes: [],
        live: new Map(),
        timers: new Set(),
      };
      runtimes.set(code, state);
    }
    return state;
  };

  const clearTimers = (code: string) => {
    const state = runtimes.get(code);
    if (!state) return;
    for (const timer of state.timers) clearTimeout(timer);
    state.timers.clear();
  };

  const schedule = (code: string, delayMs: number, task: () => Promise<void>) => {
    const state = runtime(code);
    const timer = setTimeout(() => {
      state.timers.delete(timer);
      task().catch((error: unknown) => logger.error({ err: error, code }, 'game timer failed'));
    }, delayMs);
    state.timers.add(timer);
  };

  const dispose = (code: string) => {
    clearTimers(code);
    runtimes.delete(code);
  };

  async function mustUpdate(code: string, mutate: (room: RoomState) => RoomState) {
    const room = await rooms.update(code, mutate);
    if (!room) throw new GameError('ROOM_NOT_FOUND', 'Room not found');
    return room;
  }

  /** Runs `mutate` unless the room is gone; a missing room just means everyone left. */
  async function tryUpdate(code: string, mutate: (room: RoomState) => RoomState) {
    try {
      return await rooms.update(code, mutate);
    } catch (error) {
      if (error instanceof GameError && error.code === 'ROOM_NOT_FOUND') {
        dispose(code);
        return null;
      }
      throw error;
    }
  }

  const drawMs = (room: RoomState) => drawMsOverride ?? room.settings.drawTimeS * 1000;

  const nextDrawer = (players: readonly Player[], drawn: readonly string[]) =>
    players.find((player) => player.isConnected && !drawn.includes(player.userId));

  const connectedCount = (room: RoomState) =>
    room.players.filter((player) => player.isConnected).length;

  const everyoneGuessed = (room: RoomState) =>
    room.players
      .filter((player) => player.isConnected && player.userId !== room.drawerId)
      .every((player) => player.hasGuessed);

  function toGameEnd(room: RoomState): RoomState {
    return {
      ...room,
      phase: 'game_end',
      drawerId: null,
      word: null,
      hint: null,
      wordChoices: [],
      turnEndsAt: null,
      strokes: [],
    };
  }

  function emitGameEnded(room: RoomState) {
    dispose(room.code);
    emit.toRoom(room.code, 'game:ended', { leaderboard: leaderboard(room.players) });
  }

  async function endGame(code: string) {
    const room = await tryUpdate(code, toGameEnd);
    if (room) emitGameEnded(room);
  }

  async function startNextTurn(code: string): Promise<void> {
    clearTimers(code);
    const room = await tryUpdate(code, (current) => {
      let { round, drawnThisRound } = current;
      let drawer = nextDrawer(current.players, drawnThisRound);
      if (!drawer) {
        round += 1;
        drawnThisRound = [];
        drawer = nextDrawer(current.players, drawnThisRound);
      }
      if (!drawer || round > current.settings.rounds || connectedCount(current) < 2) {
        return toGameEnd(current);
      }
      return {
        ...current,
        phase: 'choosing',
        round,
        turn: current.turn + 1,
        drawnThisRound: [...drawnThisRound, drawer.userId],
        drawerId: drawer.userId,
        wordChoices: pickWords(3),
        word: null,
        hint: null,
        turnEndsAt: now() + timings.chooseMs,
        strokes: [],
        turnScores: {},
        players: current.players.map((player) => ({ ...player, hasGuessed: false })),
      };
    });
    if (!room) return;
    if (room.phase === 'game_end') {
      emitGameEnded(room);
      return;
    }

    const state = runtime(code);
    Object.assign(state, {
      turn: room.turn,
      drawerId: room.drawerId,
      isDrawing: false,
      strokes: [],
    });
    state.live.clear();

    const drawerId = room.drawerId!;
    const endsAt = room.turnEndsAt!;
    emit.toRoom(code, 'turn:choosing', { drawerId, round: room.round, turn: room.turn, endsAt });
    emit.toUser(drawerId, 'turn:word_choices', { words: room.wordChoices, endsAt });

    const turn = room.turn;
    schedule(code, timings.chooseMs, () =>
      chooseWord(drawerId, code, Math.floor(Math.random() * 3), turn).then(() => undefined),
    );
  }

  async function chooseWord(
    userId: string,
    code: string,
    index: number,
    expectedTurn?: number,
  ): Promise<void> {
    const outcome = { stale: false };
    const room = await mustUpdate(code, (current) => {
      if (expectedTurn !== undefined && current.turn !== expectedTurn) {
        outcome.stale = true;
        return current;
      }
      if (current.phase !== 'choosing' || current.drawerId !== userId) {
        throw new GameError('NOT_DRAWER', 'It is not your turn to choose a word');
      }
      const word = current.wordChoices[index];
      if (!word) throw new GameError('VALIDATION', 'Unknown word choice');
      return {
        ...current,
        phase: 'drawing',
        word,
        hint: maskWord(word),
        wordChoices: [],
        turnEndsAt: now() + drawMs(current),
      };
    });
    if (outcome.stale) return;

    clearTimers(code);
    const state = runtime(code);
    Object.assign(state, { turn: room.turn, drawerId: userId, isDrawing: true, strokes: [] });
    state.live.clear();

    emit.toRoom(code, 'turn:started', {
      drawerId: userId,
      hint: room.hint!,
      round: room.round,
      turn: room.turn,
      endsAt: room.turnEndsAt!,
    });
    emit.toUser(userId, 'turn:word', { word: room.word! });

    const total = drawMs(room);
    const hints = Math.min(room.settings.hints, maxReveals(room.word!));
    for (let step = 1; step <= hints; step += 1) {
      schedule(code, Math.round((total * step) / (hints + 1)), () => revealHint(code, room.turn));
    }
    schedule(code, total, () => endTurn(code, 'time_up', room.turn));
  }

  async function revealHint(code: string, turn: number) {
    const outcome = { changed: false };
    const room = await tryUpdate(code, (current) => {
      if (current.turn !== turn || current.phase !== 'drawing' || !current.word || !current.hint) {
        return current;
      }
      outcome.changed = true;
      return { ...current, hint: revealLetter(current.word, current.hint) };
    });
    if (room && outcome.changed && room.hint) {
      emit.toRoom(code, 'turn:hint', { hint: room.hint });
    }
  }

  async function endTurn(code: string, reason: TurnEndReason, turn?: number): Promise<void> {
    const outcome = { ended: false, word: '' };
    const room = await tryUpdate(code, (current) => {
      if ((turn !== undefined && current.turn !== turn) || !ACTIVE_PHASES.has(current.phase)) {
        return current;
      }
      outcome.ended = true;
      outcome.word = current.word ?? '';
      return {
        ...current,
        phase: 'turn_end',
        hint: current.word,
        wordChoices: [],
        turnEndsAt: now() + timings.turnEndPauseMs,
      };
    });
    if (!room || !outcome.ended) return;

    clearTimers(code);
    const state = runtime(code);
    state.isDrawing = false;
    state.live.clear();

    emit.toRoom(code, 'turn:ended', {
      word: outcome.word,
      reason,
      scores: Object.entries(room.turnScores).map(([userId, points]) => ({ userId, points })),
    });
    schedule(code, timings.turnEndPauseMs, () => startNextTurn(code));
  }

  function assertDrawing(code: string, userId: string): Runtime {
    const state = runtimes.get(code);
    if (!state?.isDrawing || state.drawerId !== userId) {
      throw new GameError('NOT_DRAWER', 'Only the drawer can draw right now');
    }
    return state;
  }

  return {
    /** Snapshot for a (re)joining player, with the strokes of the turn in progress. */
    snapshot(room: RoomState): RoomSnapshot {
      const snapshot = toSnapshot(room);
      const state = runtimes.get(room.code);
      if (!state || !ACTIVE_PHASES.has(room.phase)) return snapshot;
      return { ...snapshot, strokes: [...state.strokes, ...state.live.values()] };
    },

    async start(userId: string, code: string): Promise<void> {
      const room = await mustUpdate(code, (current) => {
        assertHost(current, userId);
        if (current.phase !== 'lobby' && current.phase !== 'game_end') {
          throw new GameError('GAME_IN_PROGRESS', 'A game is already running');
        }
        if (connectedCount(current) < 2) {
          throw new GameError('VALIDATION', 'You need at least 2 players to start');
        }
        return {
          ...current,
          round: 1,
          turn: 0,
          drawnThisRound: [],
          turnScores: {},
          players: current.players.map((player) => ({ ...player, score: 0, hasGuessed: false })),
        };
      });
      emit.toRoom(code, 'game:started', { totalRounds: room.settings.rounds });
      emit.toRoom(code, 'room:state', toSnapshot(room));
      await startNextTurn(code);
    },

    chooseWord: (userId: string, code: string, index: number) => chooseWord(userId, code, index),

    async chat(userId: string, code: string, text: string): Promise<void> {
      const outcome: { kind: 'chat' | 'correct' | 'close' | 'private'; points: number } = {
        kind: 'chat',
        points: 0,
      };
      const room = await mustUpdate(code, (current) => {
        const player = findPlayer(current, userId);
        if (!player) throw new GameError('ROOM_NOT_FOUND', 'You are not in this room');
        if (current.phase !== 'drawing' || !current.word) return current;

        if (current.drawerId === userId || player.hasGuessed) {
          outcome.kind = 'private';
          return current;
        }
        if (!isCorrectGuess(text, current.word)) {
          if (isCloseGuess(text, current.word)) outcome.kind = 'close';
          return current;
        }

        outcome.kind = 'correct';
        outcome.points = guessPoints((current.turnEndsAt ?? 0) - now(), drawMs(current));
        const drawerId = current.drawerId;
        const turnScores = { ...current.turnScores };
        turnScores[userId] = (turnScores[userId] ?? 0) + outcome.points;
        if (drawerId) {
          turnScores[drawerId] = (turnScores[drawerId] ?? 0) + DRAWER_POINTS_PER_GUESS;
        }
        return {
          ...current,
          turnScores,
          players: current.players.map((other) => {
            if (other.userId === userId) {
              return { ...other, hasGuessed: true, score: other.score + outcome.points };
            }
            if (other.userId === drawerId) {
              return { ...other, score: other.score + DRAWER_POINTS_PER_GUESS };
            }
            return other;
          }),
        };
      });

      const message = {
        id: randomUUID(),
        kind: 'chat' as const,
        userId,
        text,
        sentAt: now(),
      };

      switch (outcome.kind) {
        case 'chat':
          emit.toRoom(code, 'chat:message', message);
          return;
        case 'close':
          emit.toRoom(code, 'chat:message', message);
          emit.toUser(userId, 'chat:message', {
            ...message,
            id: randomUUID(),
            kind: 'close_guess',
            userId: null,
            text: `'${text}' is close!`,
          });
          return;
        case 'private':
          // The drawer and players who already guessed can only talk among themselves.
          for (const player of room.players) {
            if (player.userId === room.drawerId || player.hasGuessed) {
              emit.toUser(player.userId, 'chat:message', message);
            }
          }
          return;
        case 'correct': {
          emit.toRoom(code, 'chat:correct_guess', { userId, points: outcome.points });
          for (const id of [userId, room.drawerId]) {
            const player = id ? findPlayer(room, id) : undefined;
            if (player) emit.toRoom(code, 'room:player_updated', player);
          }
          if (everyoneGuessed(room)) await endTurn(code, 'all_guessed', room.turn);
        }
      }
    },

    /** The drawer gets their secret word back after reconnecting. */
    resendPrivateState(room: RoomState, userId: string) {
      if (room.drawerId !== userId) return;
      if (room.phase === 'choosing' && room.turnEndsAt) {
        emit.toUser(userId, 'turn:word_choices', {
          words: room.wordChoices,
          endsAt: room.turnEndsAt,
        });
      } else if (room.phase === 'drawing' && room.word) {
        emit.toUser(userId, 'turn:word', { word: room.word });
      }
    },

    /** Called after a player leaves, is kicked or disconnects. */
    async playerGone(code: string, userId: string): Promise<void> {
      const room = await rooms.get(code);
      if (!room) {
        dispose(code);
        return;
      }
      if (!ACTIVE_PHASES.has(room.phase) && room.phase !== 'turn_end') return;
      if (connectedCount(room) < 2) {
        await endGame(code);
        return;
      }
      if (ACTIVE_PHASES.has(room.phase) && room.drawerId === userId) {
        await endTurn(code, 'drawer_left', room.turn);
      } else if (room.phase === 'drawing' && everyoneGuessed(room)) {
        await endTurn(code, 'all_guessed', room.turn);
      }
    },

    strokeStart(code: string, userId: string, { strokeId, style, point }: StrokeStart): void {
      const state = assertDrawing(code, userId);
      if (state.strokes.length + state.live.size >= DRAWING_LIMITS.maxStrokesPerTurn) {
        throw new GameError('RATE_LIMITED', 'Too many strokes this turn');
      }
      state.live.set(strokeId, { ...style, id: strokeId, points: [point] });
    },

    strokePoints(code: string, userId: string, { strokeId, points }: StrokePoints): void {
      const stroke = assertDrawing(code, userId).live.get(strokeId);
      if (!stroke) throw new GameError('NOT_FOUND', 'Unknown stroke');
      const room = DRAWING_LIMITS.maxPointsPerStroke - stroke.points.length;
      if (room <= 0) throw new GameError('RATE_LIMITED', 'Stroke is too long');
      stroke.points.push(...points.slice(0, room));
    },

    strokeEnd(code: string, userId: string, { strokeId }: StrokeEnd): void {
      const state = assertDrawing(code, userId);
      const stroke = state.live.get(strokeId);
      if (!stroke) throw new GameError('NOT_FOUND', 'Unknown stroke');
      state.live.delete(strokeId);
      state.strokes.push(stroke);
    },

    undo(code: string, userId: string): string | null {
      const state = assertDrawing(code, userId);
      return state.strokes.pop()?.id ?? null;
    },

    clear(code: string, userId: string): void {
      const state = assertDrawing(code, userId);
      state.strokes = [];
      state.live.clear();
    },

    dispose,

    /** Stops every timer, for shutdown and tests. */
    close() {
      for (const code of [...runtimes.keys()]) dispose(code);
    },
  };
}
