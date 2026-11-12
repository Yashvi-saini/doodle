import { usePanGesture } from 'react-native-gesture-handler';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { MIN_POINT_DISTANCE_PX } from '../constants';
import { type CanvasSize, clamp, isFarEnough } from '../lib/geometry';

export type StrokeEndHandler = (coords: number[], generation: number) => void;

export function useDrawingGesture(size: SharedValue<CanvasSize>, onStrokeEnd: StrokeEndHandler) {
  const livePoints = useSharedValue<number[]>([]);
  const generation = useSharedValue(0);

  const gesture = usePanGesture({
    maxPointers: 1,
    minDistance: 0,
    shouldCancelWhenOutside: false,
    onBegin: (event) => {
      'worklet';
      const { width, height } = size.value;
      generation.value += 1;
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
