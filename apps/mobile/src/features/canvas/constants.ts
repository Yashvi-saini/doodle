import type { HexColor } from '@doodle/shared';

export interface PaletteColor {
  value: HexColor;
  name: string;
}

export const PALETTE: readonly PaletteColor[] = [
  { value: '#1B1B1F', name: 'Black' },
  { value: '#FFFFFF', name: 'White' },
  { value: '#8A8A93', name: 'Grey' },
  { value: '#E53935', name: 'Red' },
  { value: '#FB8C00', name: 'Orange' },
  { value: '#FDD835', name: 'Yellow' },
  { value: '#43A047', name: 'Green' },
  { value: '#00897B', name: 'Teal' },
  { value: '#1E88E5', name: 'Blue' },
  { value: '#5E35B1', name: 'Purple' },
  { value: '#EC407A', name: 'Pink' },
  { value: '#6D4C41', name: 'Brown' },
];

export const BRUSH_SIZES = [
  { id: 's', value: 0.006, name: 'Small' },
  { id: 'm', value: 0.014, name: 'Medium' },
  { id: 'l', value: 0.028, name: 'Large' },
  { id: 'xl', value: 0.05, name: 'Extra large' },
] as const;

export const DEFAULT_COLOR: HexColor = '#1B1B1F';

export const DEFAULT_BRUSH_SIZE: number = BRUSH_SIZES[1].value;

export const CANVAS_BACKGROUND = '#FFFFFF';

export const MIN_POINT_DISTANCE_PX = 1.5;
