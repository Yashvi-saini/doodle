import type { HexColor } from '@doodle/shared';

export const PALETTE: readonly HexColor[] = [
  '#1B1B1F',
  '#FFFFFF',
  '#8A8A93',
  '#E53935',
  '#FB8C00',
  '#FDD835',
  '#43A047',
  '#00897B',
  '#1E88E5',
  '#5E35B1',
  '#EC407A',
  '#6D4C41',
];

export const BRUSH_SIZES = [
  { id: 's', value: 0.006 },
  { id: 'm', value: 0.014 },
  { id: 'l', value: 0.028 },
  { id: 'xl', value: 0.05 },
] as const;

export const DEFAULT_COLOR: HexColor = '#1B1B1F';

export const DEFAULT_BRUSH_SIZE: number = BRUSH_SIZES[1].value;

export const CANVAS_BACKGROUND = '#FFFFFF';

export const MIN_POINT_DISTANCE_PX = 1.5;
