import { DRAWING_LIMITS, type Stroke } from '@doodle/shared';
import { describe, expect, it } from 'vitest';
import {
  addStroke,
  canRedo,
  canUndo,
  clearCanvas,
  type DrawingHistory,
  emptyHistory,
  redo,
  undo,
  visibleStrokes,
} from './history';

const stroke = (id: string): Stroke => ({
  id,
  tool: 'brush',
  color: '#000000',
  size: 0.01,
  points: [[0.5, 0.5]],
});

const ids = (history: DrawingHistory) => visibleStrokes(history).map((s) => s.id);

const drawn = (...strokeIds: string[]) =>
  strokeIds.reduce((history, id) => addStroke(history, stroke(id)), emptyHistory);

describe('drawing history', () => {
  it('starts empty with nothing to undo or redo', () => {
    expect(ids(emptyHistory)).toEqual([]);
    expect(canUndo(emptyHistory)).toBe(false);
    expect(canRedo(emptyHistory)).toBe(false);
  });

  it('undoes and redoes strokes in order', () => {
    const history = drawn('a', 'b', 'c');
    const undoneTwice = undo(undo(history));
    expect(ids(undoneTwice)).toEqual(['a']);
    expect(canRedo(undoneTwice)).toBe(true);

    expect(ids(redo(undoneTwice))).toEqual(['a', 'b']);
    expect(ids(redo(redo(undoneTwice)))).toEqual(['a', 'b', 'c']);
  });

  it('drops the redo stack when a new stroke is drawn', () => {
    const history = addStroke(undo(drawn('a', 'b')), stroke('x'));
    expect(ids(history)).toEqual(['a', 'x']);
    expect(canRedo(history)).toBe(false);
  });

  it('treats clear as an undoable step', () => {
    const cleared = clearCanvas(drawn('a', 'b'));
    expect(ids(cleared)).toEqual([]);
    expect(ids(undo(cleared))).toEqual(['a', 'b']);
    expect(ids(redo(undo(cleared)))).toEqual([]);
  });

  it('only shows strokes drawn after the last clear', () => {
    const history = addStroke(clearCanvas(drawn('a')), stroke('b'));
    expect(ids(history)).toEqual(['b']);
  });

  it('ignores clear on an empty canvas', () => {
    expect(clearCanvas(emptyHistory)).toBe(emptyHistory);
  });

  it('ignores undo and redo when there is nothing to do', () => {
    expect(undo(emptyHistory)).toBe(emptyHistory);
    expect(redo(emptyHistory)).toBe(emptyHistory);
  });

  it('stops accepting strokes at the per-turn limit', () => {
    const full = Array.from({ length: DRAWING_LIMITS.maxStrokesPerTurn }, (_, index) =>
      stroke(String(index)),
    ).reduce(addStroke, emptyHistory);
    expect(addStroke(full, stroke('extra'))).toBe(full);
  });
});
