import { DRAWING_LIMITS, type Point } from '@doodle/shared';

const PRECISION = 10_000;

export interface CanvasSize {
  width: number;
  height: number;
}

export function toUnit(value: number, extent: number): number {
  if (extent <= 0) return 0;
  const clamped = Math.min(Math.max(value / extent, 0), 1);
  return Math.round(clamped * PRECISION) / PRECISION;
}

export function normalizePoints(coords: readonly number[], size: CanvasSize): Point[] {
  const points: Point[] = [];
  for (let index = 0; index + 1 < coords.length; index += 2) {
    points.push([
      toUnit(coords[index] ?? 0, size.width),
      toUnit(coords[index + 1] ?? 0, size.height),
    ]);
  }
  return points;
}

export function flattenPoints(points: readonly Point[]): number[] {
  const coords: number[] = [];
  for (const [x, y] of points) {
    coords.push(x, y);
  }
  return coords;
}

export function capPoints(
  points: Point[],
  max: number = DRAWING_LIMITS.maxPointsPerStroke,
): Point[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => points[Math.round(index * step)] as Point);
}

export function brushSizeToPixels(size: number, canvasWidth: number): number {
  return Math.max(size * canvasWidth, 1);
}

export function isFarEnough(
  lastX: number,
  lastY: number,
  x: number,
  y: number,
  minDistance: number,
): boolean {
  'worklet';
  const dx = x - lastX;
  const dy = y - lastY;
  return dx * dx + dy * dy >= minDistance * minDistance;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}
