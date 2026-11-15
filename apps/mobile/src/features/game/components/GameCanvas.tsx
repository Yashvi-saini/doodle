import { CANVAS_ASPECT_RATIO, Stroke } from '@doodle/shared';
import { Canvas, Fill, Group, Path, usePathValue } from '@shopify/react-native-skia';
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { colors } from '../../../theme/colors';
import { StrokePath } from '../../canvas/components/StrokePath';
import { CANVAS_BACKGROUND } from '../../canvas/constants';
import { useDrawingGesture } from '../../canvas/hooks/useDrawingGesture';
import {
  brushSizeToPixels,
  type CanvasSize,
  capPoints,
  normalizePoints,
} from '../../canvas/lib/geometry';
import { createStrokeId } from '../../canvas/lib/ids';
import { traceSmoothPath } from '../../canvas/lib/path';
import { useCanvasStore } from '../../canvas/store/canvas.store';
import { gameActions, useGameStore } from '../store/game.store';

interface InProgress {
  generation: number;
  stroke: Stroke;
  sentCoords: number;
}

interface GameCanvasProps {
  canDraw: boolean;
  /** Rendered on top of the canvas, e.g. word choices or the turn result. */
  overlay?: ReactNode;
}

export function GameCanvas({ canDraw, overlay }: GameCanvasProps) {
  const strokes = useGameStore((state) => state.room?.strokes);
  const live = useGameStore((state) => state.live);
  const tool = useCanvasStore((state) => state.tool);
  const color = useCanvasStore((state) => state.color);
  const brushSize = useCanvasStore((state) => state.brushSize);

  const [layout, setLayout] = useState<CanvasSize>({ width: 0, height: 0 });
  const size = useSharedValue<CanvasSize>({ width: 0, height: 0 });
  const committedGeneration = useRef(0);
  const current = useRef<InProgress | null>(null);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      size.set({ width, height });
      setLayout({ width, height });
    },
    [size],
  );

  /** Starts a stroke on the server from its first chunk of pixel coords. */
  const begin = useCallback(
    (coords: number[], generation: number): InProgress | null => {
      const {
        tool: activeTool,
        color: activeColor,
        brushSize: activeSize,
      } = useCanvasStore.getState();
      const style =
        activeTool === 'eraser'
          ? { tool: 'eraser' as const, size: activeSize }
          : { tool: 'brush' as const, color: activeColor, size: activeSize };
      const parsed = Stroke.safeParse({
        ...style,
        id: createStrokeId(),
        points: normalizePoints(coords, size.get()),
      });
      if (!parsed.success) return null;
      gameActions.strokeStart(parsed.data);
      return { generation, stroke: parsed.data, sentCoords: coords.length };
    },
    [size],
  );

  const onStrokeProgress = useCallback(
    (coords: number[], generation: number) => {
      const active = current.current;
      if (active?.generation !== generation) {
        current.current = begin(coords, generation);
        return;
      }
      gameActions.strokePoints(active.stroke.id, normalizePoints(coords, size.get()));
      active.sentCoords += coords.length;
    },
    [begin, size],
  );

  const onStrokeEnd = useCallback(
    (coords: number[], generation: number) => {
      committedGeneration.current = generation;
      let active = current.current;
      if (active?.generation === generation) {
        const rest = coords.slice(active.sentCoords);
        if (rest.length > 0) {
          gameActions.strokePoints(active.stroke.id, normalizePoints(rest, size.get()));
        }
      } else {
        active = begin(coords, generation);
      }
      current.current = null;
      if (!active) return;
      gameActions.strokeEnd({
        ...active.stroke,
        points: capPoints(normalizePoints(coords, size.get())),
      });
    },
    [begin, size],
  );

  const { gesture, livePoints, generation } = useDrawingGesture(size, onStrokeEnd, {
    enabled: canDraw,
    onStrokeProgress,
  });

  // Drop the local live path once its stroke has been committed to the store.
  useLayoutEffect(() => {
    if (generation.get() === committedGeneration.current) {
      livePoints.set([]);
    }
  }, [strokes, generation, livePoints]);

  const livePath = usePathValue((builder) => {
    'worklet';
    traceSmoothPath(builder, livePoints.value);
  });

  const visible = useMemo(() => [...(strokes ?? []), ...Object.values(live)], [strokes, live]);
  const isEraser = tool === 'eraser';

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.frame} onLayout={onLayout} collapsable={false}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color={CANVAS_BACKGROUND} />
          {layout.width > 0 && (
            <Group layer>
              {visible.map((stroke) => (
                <StrokePath
                  key={stroke.id}
                  stroke={stroke}
                  width={layout.width}
                  height={layout.height}
                />
              ))}
              {canDraw && (
                <Path
                  path={livePath}
                  style="stroke"
                  strokeWidth={brushSizeToPixels(brushSize, layout.width)}
                  strokeCap="round"
                  strokeJoin="round"
                  color={isEraser ? '#000000' : color}
                  blendMode={isEraser ? 'clear' : 'srcOver'}
                />
              )}
            </Group>
          )}
        </Canvas>
        {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: CANVAS_ASPECT_RATIO,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: CANVAS_BACKGROUND,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(244, 241, 234, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
