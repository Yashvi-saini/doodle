import { DRAWING_LIMITS, type Stroke } from '@doodle/shared';

export type HistoryEntry = { type: 'stroke'; stroke: Stroke } | { type: 'clear' };

export interface DrawingHistory {
  done: readonly HistoryEntry[];
  undone: readonly HistoryEntry[];
}

export const emptyHistory: DrawingHistory = { done: [], undone: [] };

export function visibleStrokes(history: DrawingHistory): Stroke[] {
  const strokes: Stroke[] = [];
  for (const entry of history.done) {
    if (entry.type === 'clear') {
      strokes.length = 0;
    } else {
      strokes.push(entry.stroke);
    }
  }
  return strokes;
}

export function addStroke(history: DrawingHistory, stroke: Stroke): DrawingHistory {
  if (visibleStrokes(history).length >= DRAWING_LIMITS.maxStrokesPerTurn) {
    return history;
  }
  return { done: [...history.done, { type: 'stroke', stroke }], undone: [] };
}

export function clearCanvas(history: DrawingHistory): DrawingHistory {
  if (visibleStrokes(history).length === 0) {
    return history;
  }
  return { done: [...history.done, { type: 'clear' }], undone: [] };
}

export function undo(history: DrawingHistory): DrawingHistory {
  const last = history.done[history.done.length - 1];
  if (!last) return history;
  return { done: history.done.slice(0, -1), undone: [...history.undone, last] };
}

export function redo(history: DrawingHistory): DrawingHistory {
  const next = history.undone[history.undone.length - 1];
  if (!next) return history;
  return { done: [...history.done, next], undone: history.undone.slice(0, -1) };
}

export const canUndo = (history: DrawingHistory) => history.done.length > 0;

export const canRedo = (history: DrawingHistory) => history.undone.length > 0;
