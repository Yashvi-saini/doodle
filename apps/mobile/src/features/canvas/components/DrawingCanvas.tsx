import { CANVAS_ASPECT_RATIO } from '@doodle/shared';
import { Canvas, Fill, Group, Path, usePathValue } from '@shopify/react-native-skia';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { colors } from '../../../theme/colors';
import { CANVAS_BACKGROUND } from '../constants';
import { useDrawingGesture } from '../hooks/useDrawingGesture';
import { brushSizeToPixels, type CanvasSize, normalizePoints } from '../lib/geometry';
import { visibleStrokes } from '../lib/history';
import { traceSmoothPath } from '../lib/path';
import { useCanvasStore } from '../store/canvas.store';
import { StrokePath } from './StrokePath';

export function DrawingCanvas() {
  const history = useCanvasStore((state) => state.history);
  const tool = useCanvasStore((state) => state.tool);
  const color = useCanvasStore((state) => state.color);
  const brushSize = useCanvasStore((state) => state.brushSize);
  const commitStroke = useCanvasStore((state) => state.commitStroke);

  const [layout, setLayout] = useState<CanvasSize>({ width: 0, height: 0 });
  const size = useSharedValue<CanvasSize>({ width: 0, height: 0 });
  const committedGeneration = useRef(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      size.set({ width, height });
      setLayout({ width, height });
    },
    [size],
  );

  const onStrokeEnd = useCallback(
    (coords: number[], generation: number) => {
      committedGeneration.current = generation;
      commitStroke(normalizePoints(coords, size.get()));
    },
    [commitStroke, size],
  );

  const { gesture, livePoints, generation } = useDrawingGesture(size, onStrokeEnd);

  useLayoutEffect(() => {
    if (generation.get() === committedGeneration.current) {
      livePoints.set([]);
    }
  }, [history, generation, livePoints]);

  const livePath = usePathValue((builder) => {
    'worklet';
    traceSmoothPath(builder, livePoints.value);
  });

  const strokes = useMemo(() => visibleStrokes(history), [history]);
  const isEraser = tool === 'eraser';

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.frame} onLayout={onLayout} collapsable={false}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color={CANVAS_BACKGROUND} />
          {layout.width > 0 && (
            <Group layer>
              {strokes.map((stroke) => (
                <StrokePath
                  key={stroke.id}
                  stroke={stroke}
                  width={layout.width}
                  height={layout.height}
                />
              ))}
              <Path
                path={livePath}
                style="stroke"
                strokeWidth={brushSizeToPixels(brushSize, layout.width)}
                strokeCap="round"
                strokeJoin="round"
                color={isEraser ? '#000000' : color}
                blendMode={isEraser ? 'clear' : 'srcOver'}
              />
            </Group>
          )}
        </Canvas>
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
});
