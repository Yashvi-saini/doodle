import { type HexColor, type Point, Stroke, type Tool } from '@doodle/shared';
import { create } from 'zustand';
import { DEFAULT_BRUSH_SIZE, DEFAULT_COLOR } from '../constants';
import { capPoints } from '../lib/geometry';
import {
  addStroke,
  clearCanvas,
  type DrawingHistory,
  emptyHistory,
  redo,
  undo,
} from '../lib/history';
import { createStrokeId } from '../lib/ids';

export interface CanvasState {
  tool: Tool;
  color: HexColor;
  brushSize: number;
  history: DrawingHistory;
}

export interface CanvasActions {
  setTool: (tool: Tool) => void;
  setColor: (color: HexColor) => void;
  setBrushSize: (size: number) => void;
  commitStroke: (points: Point[]) => Stroke | null;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  reset: () => void;
}

export type CanvasStore = CanvasState & CanvasActions;

export const initialCanvasState: CanvasState = {
  tool: 'brush',
  color: DEFAULT_COLOR,
  brushSize: DEFAULT_BRUSH_SIZE,
  history: emptyHistory,
};

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
  ...initialCanvasState,

  setTool: (tool) => set({ tool }),

  setColor: (color) => set({ color, tool: 'brush' }),

  setBrushSize: (brushSize) => set({ brushSize }),

  commitStroke: (points) => {
    if (points.length === 0) return null;
    const { tool, color, brushSize, history } = get();
    const style =
      tool === 'eraser'
        ? { tool: 'eraser' as const, size: brushSize }
        : { tool: 'brush' as const, color, size: brushSize };

    const parsed = Stroke.safeParse({ ...style, id: createStrokeId(), points: capPoints(points) });
    if (!parsed.success) return null;

    set({ history: addStroke(history, parsed.data) });
    return parsed.data;
  },

  undo: () => set({ history: undo(get().history) }),

  redo: () => set({ history: redo(get().history) }),

  clear: () => set({ history: clearCanvas(get().history) }),

  reset: () => set(initialCanvasState),
}));
