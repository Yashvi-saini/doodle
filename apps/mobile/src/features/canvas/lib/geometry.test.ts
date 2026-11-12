import { Point } from '@doodle/shared';
import { describe, expect, it } from 'vitest';
import {
  brushSizeToPixels,
  capPoints,
  flattenPoints,
  isFarEnough,
  normalizePoints,
  toUnit,
} from './geometry';

describe('toUnit', () => {
  it('converts pixels to a 0..1 fraction', () => {
    expect(toUnit(150, 300)).toBe(0.5);
    expect(toUnit(0, 300)).toBe(0);
    expect(toUnit(300, 300)).toBe(1);
  });

  it('clamps positions outside the canvas', () => {
    expect(toUnit(-20, 300)).toBe(0);
    expect(toUnit(999, 300)).toBe(1);
  });

  it('rounds to four decimal places to keep payloads small', () => {
    expect(toUnit(100, 300)).toBe(0.3333);
  });

  it('returns 0 for a zero-sized canvas', () => {
    expect(toUnit(10, 0)).toBe(0);
  });
});

describe('normalizePoints', () => {
  it('produces points that pass the shared schema on any screen size', () => {
    const small = normalizePoints([0, 0, 180, 135, 360, 270], { width: 360, height: 270 });
    const large = normalizePoints([0, 0, 600, 450, 1200, 900], { width: 1200, height: 900 });

    expect(small).toEqual([
      [0, 0],
      [0.5, 0.5],
      [1, 1],
    ]);
    expect(large).toEqual(small);
    for (const point of small) {
      expect(Point.safeParse(point).success).toBe(true);
    }
  });

  it('ignores a trailing odd coordinate', () => {
    expect(normalizePoints([10, 10, 20], { width: 100, height: 100 })).toEqual([[0.1, 0.1]]);
  });
});

describe('flattenPoints', () => {
  it('turns tuples into an x,y,x,y list', () => {
    expect(
      flattenPoints([
        [0.1, 0.2],
        [0.3, 0.4],
      ]),
    ).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});

describe('capPoints', () => {
  it('keeps short strokes unchanged', () => {
    const points: Point[] = [
      [0, 0],
      [1, 1],
    ];
    expect(capPoints(points, 10)).toBe(points);
  });

  it('downsamples long strokes but keeps the first and last point', () => {
    const points = Array.from({ length: 101 }, (_, index): Point => [index / 100, 0]);
    const capped = capPoints(points, 11);
    expect(capped).toHaveLength(11);
    expect(capped[0]).toEqual([0, 0]);
    expect(capped[10]).toEqual([1, 0]);
  });
});

describe('brushSizeToPixels', () => {
  it('scales with canvas width and never drops below one pixel', () => {
    expect(brushSizeToPixels(0.01, 400)).toBe(4);
    expect(brushSizeToPixels(0.01, 800)).toBe(8);
    expect(brushSizeToPixels(0.002, 100)).toBe(1);
  });
});

describe('isFarEnough', () => {
  it('compares the squared distance against the threshold', () => {
    expect(isFarEnough(0, 0, 3, 4, 5)).toBe(true);
    expect(isFarEnough(0, 0, 1, 1, 5)).toBe(false);
  });
});
