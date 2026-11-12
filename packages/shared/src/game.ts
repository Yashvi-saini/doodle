import { z } from 'zod';
import { DisplayName, EpochMs, UserId } from './common.js';
import { Stroke } from './drawing.js';

export const RoomCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, { message: 'Room code must be 6 letters or digits' });
export type RoomCode = z.infer<typeof RoomCode>;

export const GameSettings = z.object({
  rounds: z.int().min(1).max(10),
  drawTimeS: z.int().min(30).max(240),
  maxPlayers: z.int().min(2).max(12),
  hints: z.int().min(0).max(5),
  packId: z.uuid().nullable(),
  visibility: z.enum(['public', 'private']),
});
export type GameSettings = z.infer<typeof GameSettings>;

export const GameSettingsPatch = GameSettings.partial();
export type GameSettingsPatch = z.infer<typeof GameSettingsPatch>;

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  rounds: 3,
  drawTimeS: 80,
  maxPlayers: 8,
  hints: 2,
  packId: null,
  visibility: 'private',
};

export const GamePhase = z.enum(['lobby', 'choosing', 'drawing', 'turn_end', 'game_end']);
export type GamePhase = z.infer<typeof GamePhase>;

export const Player = z.object({
  userId: UserId,
  displayName: DisplayName,
  avatarUrl: z.url().nullable(),
  score: z.int().nonnegative(),
  isConnected: z.boolean(),
  hasGuessed: z.boolean(),
});
export type Player = z.infer<typeof Player>;

export const RoomSnapshot = z.object({
  code: RoomCode,
  hostId: UserId,
  settings: GameSettings,
  phase: GamePhase,
  players: z.array(Player),
  round: z.int().nonnegative(),
  turn: z.int().nonnegative(),
  drawerId: UserId.nullable(),
  hint: z.string().nullable(),
  turnEndsAt: EpochMs.nullable(),
  strokes: z.array(Stroke),
});
export type RoomSnapshot = z.infer<typeof RoomSnapshot>;

export const ScoreDelta = z.object({
  userId: UserId,
  points: z.int().nonnegative(),
});
export type ScoreDelta = z.infer<typeof ScoreDelta>;

export const TurnEndReason = z.enum(['time_up', 'all_guessed', 'drawer_left']);
export type TurnEndReason = z.infer<typeof TurnEndReason>;

export const LeaderboardEntry = z.object({
  userId: UserId,
  score: z.int().nonnegative(),
  rank: z.int().min(1),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const ChatMessage = z.object({
  id: z.string().min(1),
  kind: z.enum(['chat', 'system', 'close_guess']),
  userId: UserId.nullable(),
  text: z.string().max(200),
  sentAt: EpochMs,
});
export type ChatMessage = z.infer<typeof ChatMessage>;
