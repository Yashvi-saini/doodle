import type { RoomState } from '../services/room-state.js';

export type RoomMutation = (room: RoomState) => RoomState | null;

export interface RoomRepository {
  get(code: string): Promise<RoomState | null>;
  create(room: RoomState): Promise<boolean>;
  update(code: string, mutate: RoomMutation): Promise<RoomState | null>;
}
