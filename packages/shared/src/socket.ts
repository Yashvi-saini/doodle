import { z } from 'zod';
import { type AckResult, Empty, EpochMs, ErrorBody, UserId } from './common.js';
import { StrokeEnd, StrokePoints, StrokeRemoved, StrokeStart } from './drawing.js';
import {
  ChatMessage,
  GameSettings,
  LeaderboardEntry,
  Player,
  RoomCode,
  RoomSnapshot,
  ScoreDelta,
  TurnEndReason,
} from './game.js';

export const SocketAuth = z.object({ token: z.string().min(1) });
export type SocketAuth = z.infer<typeof SocketAuth>;

export const RoomCreatePayload = z.object({ settings: GameSettings.partial().default({}) });
export const RoomJoinPayload = z.object({ code: RoomCode });
export const RoomUpdateSettingsPayload = z.object({ settings: GameSettings.partial() });
export const RoomKickPayload = z.object({ userId: UserId });
export const TurnChooseWordPayload = z.object({ index: z.int().min(0).max(2) });
export const ChatSendPayload = z.object({ text: z.string().trim().min(1).max(100) });

interface ClientEventDef {
  payload: z.ZodType;
  ack?: z.ZodType;
}

export const clientEvents = {
  'room:create': { payload: RoomCreatePayload, ack: RoomSnapshot },
  'room:join': { payload: RoomJoinPayload, ack: RoomSnapshot },
  'room:leave': { payload: Empty },
  'room:update_settings': { payload: RoomUpdateSettingsPayload, ack: GameSettings },
  'room:kick': { payload: RoomKickPayload, ack: Empty },
  'game:start': { payload: Empty, ack: Empty },
  'turn:choose_word': { payload: TurnChooseWordPayload, ack: Empty },
  'draw:stroke_start': { payload: StrokeStart },
  'draw:stroke_points': { payload: StrokePoints },
  'draw:stroke_end': { payload: StrokeEnd },
  'draw:undo': { payload: Empty },
  'draw:clear': { payload: Empty },
  'chat:send': { payload: ChatSendPayload },
} satisfies Record<string, ClientEventDef>;

export const serverEvents = {
  'room:state': RoomSnapshot,
  'room:player_joined': Player,
  'room:player_left': z.object({ userId: UserId }),
  'room:player_updated': Player,
  'room:host_changed': z.object({ userId: UserId }),
  'room:settings_updated': GameSettings,
  'room:kicked': z.object({ reason: z.string() }),
  'game:started': z.object({ totalRounds: z.int().min(1) }),
  'game:ended': z.object({ leaderboard: z.array(LeaderboardEntry) }),
  'turn:choosing': z.object({
    drawerId: UserId,
    round: z.int().min(1),
    turn: z.int().min(1),
    endsAt: EpochMs,
  }),
  'turn:word_choices': z.object({ words: z.array(z.string()).length(3), endsAt: EpochMs }),
  'turn:started': z.object({
    drawerId: UserId,
    hint: z.string(),
    round: z.int().min(1),
    turn: z.int().min(1),
    endsAt: EpochMs,
  }),
  'turn:word': z.object({ word: z.string() }),
  'turn:hint': z.object({ hint: z.string() }),
  'turn:ended': z.object({
    word: z.string(),
    reason: TurnEndReason,
    scores: z.array(ScoreDelta),
  }),
  'draw:stroke_start': StrokeStart,
  'draw:stroke_points': StrokePoints,
  'draw:stroke_end': StrokeEnd,
  'draw:undo': StrokeRemoved,
  'draw:clear': Empty,
  'chat:message': ChatMessage,
  'chat:correct_guess': z.object({ userId: UserId, points: z.int().nonnegative() }),
  'server:error': ErrorBody,
} satisfies Record<string, z.ZodType>;

export type ClientEventName = keyof typeof clientEvents;
export type ServerEventName = keyof typeof serverEvents;

export type ClientPayload<E extends ClientEventName> = z.infer<(typeof clientEvents)[E]['payload']>;
export type ServerPayload<E extends ServerEventName> = z.infer<(typeof serverEvents)[E]>;

type ClientHandler<D extends ClientEventDef> = D extends { ack: infer A extends z.ZodType }
  ? (payload: z.input<D['payload']>, ack: (result: AckResult<z.infer<A>>) => void) => void
  : (payload: z.input<D['payload']>) => void;

export type ClientToServerEvents = {
  [E in ClientEventName]: ClientHandler<(typeof clientEvents)[E]>;
};

export type ServerToClientEvents = {
  [E in ServerEventName]: (payload: ServerPayload<E>) => void;
};
