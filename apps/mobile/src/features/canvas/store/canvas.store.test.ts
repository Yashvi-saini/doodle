import { DRAWING_LIMITS, type Point } from '@doodle/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BRUSH_SIZE } from '../constants';
import { visibleStrokes } from '../lib/history';
import { useCanvasStore } from './canvas.store';

const store = () => useCanvasStore.getState();
const visible = () => visibleStrokes(store().history);

const line: Point[] = [
  [0.1, 0.1],
  [0.2, 0.2],
];

beforeEach(() => {
  store().reset();
});

describe('canvas store', () => {
  it('records a brush stroke with the current colour and size', () => {
    store().setColor('#E53935');
    store().setBrushSize(0.028);
    const stroke = store().commitStroke(line);

    expect(stroke).toMatchObject({ tool: 'brush', color: '#E53935', size: 0.028, points: line });
    expect(visible()).toHaveLength(1);
  });

  it('records eraser strokes without a colour', () => {
    store().setTool('eraser');
    const stroke = store().commitStroke(line);

    expect(stroke).toEqual({
      id: expect.any(String) as string,
      tool: 'eraser',
      size: DEFAULT_BRUSH_SIZE,
      points: line,
    });
  });

  it('switches back to the brush when a colour is picked', () => {
    store().setTool('eraser');
    store().setColor('#43A047');
    expect(store().tool).toBe('brush');
  });

  it('gives every stroke a unique id', () => {
    const first = store().commitStroke(line);
    const second = store().commitStroke(line);
    expect(first?.id).not.toBe(second?.id);
  });

  it('ignores empty strokes and invalid points', () => {
    expect(store().commitStroke([])).toBeNull();
    expect(store().commitStroke([[2, 2]])).toBeNull();
    expect(visible()).toHaveLength(0);
  });

  it('caps very long strokes to the shared point limit', () => {
    const long = Array.from(
      { length: DRAWING_LIMITS.maxPointsPerStroke * 2 },
      (_, index): Point => [index / (DRAWING_LIMITS.maxPointsPerStroke * 2), 0.5],
    );
    expect(store().commitStroke(long)?.points).toHaveLength(DRAWING_LIMITS.maxPointsPerStroke);
  });

  it('undoes, redoes and clears', () => {
    store().commitStroke(line);
    store().commitStroke(line);

    store().undo();
    expect(visible()).toHaveLength(1);

    store().redo();
    expect(visible()).toHaveLength(2);

    store().clear();
    expect(visible()).toHaveLength(0);

    store().undo();
    expect(visible()).toHaveLength(2);
  });
});
