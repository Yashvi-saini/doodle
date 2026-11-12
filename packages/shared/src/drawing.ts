import { z } from 'zod';

export const DRAWING_LIMITS = {
  maxPointsPerStroke: 4000,
  maxPointsPerBatch: 64,
  maxStrokesPerTurn: 2000,
  minBrushSize: 0.002,
  maxBrushSize: 0.1,
} as const;

export const Unit = z.number().min(0).max(1);

export const Point = z.tuple([Unit, Unit]);
export type Point = z.infer<typeof Point>;

export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, {
  message: 'Colour must be a #RRGGBB hex string',
});
export type HexColor = z.infer<typeof HexColor>;

export const BrushSize = z
  .number()
  .min(DRAWING_LIMITS.minBrushSize)
  .max(DRAWING_LIMITS.maxBrushSize);

export const Tool = z.enum(['brush', 'eraser']);
export type Tool = z.infer<typeof Tool>;

export const StrokeId = z.string().min(1).max(64);
export type StrokeId = z.infer<typeof StrokeId>;

const BrushStyle = z.object({ tool: z.literal('brush'), color: HexColor, size: BrushSize });
const EraserStyle = z.object({ tool: z.literal('eraser'), size: BrushSize });

export const StrokeStyle = z.discriminatedUnion('tool', [BrushStyle, EraserStyle]);
export type StrokeStyle = z.infer<typeof StrokeStyle>;

export const Stroke = z.discriminatedUnion('tool', [
  BrushStyle.extend({
    id: StrokeId,
    points: z.array(Point).min(1).max(DRAWING_LIMITS.maxPointsPerStroke),
  }),
  EraserStyle.extend({
    id: StrokeId,
    points: z.array(Point).min(1).max(DRAWING_LIMITS.maxPointsPerStroke),
  }),
]);
export type Stroke = z.infer<typeof Stroke>;

export const StrokeStart = z.object({
  strokeId: StrokeId,
  style: StrokeStyle,
  point: Point,
});
export type StrokeStart = z.infer<typeof StrokeStart>;

export const StrokePoints = z.object({
  strokeId: StrokeId,
  points: z.array(Point).min(1).max(DRAWING_LIMITS.maxPointsPerBatch),
});
export type StrokePoints = z.infer<typeof StrokePoints>;

export const StrokeEnd = z.object({ strokeId: StrokeId });
export type StrokeEnd = z.infer<typeof StrokeEnd>;

export const StrokeRemoved = z.object({ strokeId: StrokeId });
export type StrokeRemoved = z.infer<typeof StrokeRemoved>;
