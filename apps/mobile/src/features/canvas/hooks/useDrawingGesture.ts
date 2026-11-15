import { usePanGesture } from 'react-native-gesture-handler';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { MIN_POINT_DISTANCE_PX } from '../constants';
import { type CanvasSize, clamp, isFarEnough } from '../lib/geometry';

export type StrokeEndHandler = (coords: number[], generation: number) => void;
/** Receives the pixel coords added since the previous call, while the stroke is in progress. */
export type StrokeProgressHandler = (coords: number[], generation: number) => void;

/** Coords (x and y each count) to collect before streaming a chunk: 8 points. */
const PROGRESS_CHUNK = 16;

const noop: StrokeProgressHandler = () => undefined;

export interface DrawingGestureOptions {
  enabled?: boolean;
  onStrokeProgress?: StrokeProgressHandler;
}

export function useDrawingGesture(
  size: SharedValue<CanvasSize>,
  onStrokeEnd: StrokeEndHandler,
  { enabled = true, onStrokeProgress }: DrawingGestureOptions = {},
) {
  const livePoints = useSharedValue<number[]>([]);
  const generation = useSharedValue(0);
  const sent = useSharedValue(0);
  const streams = onStrokeProgress !== undefined;
  const onProgress = onStrokeProgress ?? noop;

  const gesture = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 0,
    shouldCancelWhenOutside: false,
    onBegin: (event) => {
      'worklet';
      const { width, height } = size.value;
      generation.value += 1;
      sent.value = 0;
      livePoints.value = [clamp(event.x, 0, width), clamp(event.y, 0, height)];
    },
    onUpdate: (event) => {
      'worklet';
      const { width, height } = size.value;
      const x = clamp(event.x, 0, width);
      const y = clamp(event.y, 0, height);
      livePoints.modify((points) => {
        'worklet';
        const count = points.length;
        const lastX = points[count - 2];
        const lastY = points[count - 1];
        if (
          lastX !== undefined &&
          lastY !== undefined &&
          !isFarEnough(lastX, lastY, x, y, MIN_POINT_DISTANCE_PX)
        ) {
          return points;
        }
        points.push(x, y);
        return points;
      });
      if (streams) {
        const points = livePoints.value;
        if (points.length - sent.value >= PROGRESS_CHUNK) {
          scheduleOnRN(onProgress, points.slice(sent.value), generation.value);
          sent.value = points.length;
        }
      }
    },
    onFinalize: () => {
      'worklet';
      const points = livePoints.value;
      if (points.length > 0) {
        scheduleOnRN(onStrokeEnd, points.slice(), generation.value);
      }
    },
  });

  return { gesture, livePoints, generation };
}
