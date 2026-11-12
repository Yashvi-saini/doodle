import { describe, expect, it } from 'vitest';
import { DRAWING_LIMITS, Stroke, StrokePoints, StrokeStart } from './drawing.js';

const brushStroke = {
  id: 's1',
  tool: 'brush',
  color: '#ff0000',
  size: 0.01,
  points: [
    [0, 0],
    [0.5, 0.25],
    [1, 1],
  ],
};

describe('Stroke', () => {
  it('accepts a brush stroke with normalised points', () => {
    expect(Stroke.parse(brushStroke)).toEqual(brushStroke);
  });

  it('accepts an eraser stroke without a colour', () => {
    const eraser = { id: 's2', tool: 'eraser', size: 0.05, points: [[0.1, 0.1]] };
    expect(Stroke.parse(eraser)).toEqual(eraser);
  });

  it('rejects a brush stroke without a colour', () => {
    const { color: _color, ...noColor } = brushStroke;
    expect(Stroke.safeParse(noColor).success).toBe(false);
  });

  it.each([[[1.01, 0.5]], [[-0.01, 0.5]], [[0.5, 2]]])(
    'rejects coordinates outside 0..1: %j',
    (point) => {
      expect(Stroke.safeParse({ ...brushStroke, points: [point] }).success).toBe(false);
    },
  );

  it('rejects malformed colours', () => {
    expect(Stroke.safeParse({ ...brushStroke, color: 'red' }).success).toBe(false);
    expect(Stroke.safeParse({ ...brushStroke, color: '#fff' }).success).toBe(false);
  });

  it('rejects brush sizes outside the allowed range', () => {
    expect(Stroke.safeParse({ ...brushStroke, size: 0 }).success).toBe(false);
    expect(Stroke.safeParse({ ...brushStroke, size: 0.5 }).success).toBe(false);
  });

  it('rejects an empty stroke', () => {
    expect(Stroke.safeParse({ ...brushStroke, points: [] }).success).toBe(false);
  });

  it('rejects strokes over the point limit', () => {
    const points = Array.from({ length: DRAWING_LIMITS.maxPointsPerStroke + 1 }, () => [0.5, 0.5]);
    expect(Stroke.safeParse({ ...brushStroke, points }).success).toBe(false);
  });
});

describe('streaming payloads', () => {
  it('accepts a stroke start', () => {
    const payload = {
      strokeId: 'abc',
      style: { tool: 'brush', color: '#000000', size: 0.01 },
      point: [0.2, 0.3],
    };
    expect(StrokeStart.parse(payload)).toEqual(payload);
  });

  it('caps the batch size of streamed points', () => {
    const points = Array.from({ length: DRAWING_LIMITS.maxPointsPerBatch + 1 }, () => [0.5, 0.5]);
    expect(StrokePoints.safeParse({ strokeId: 'abc', points }).success).toBe(false);
  });
});
