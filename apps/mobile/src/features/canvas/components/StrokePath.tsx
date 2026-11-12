import type { Stroke } from '@doodle/shared';
import { Path, Skia } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { brushSizeToPixels, flattenPoints } from '../lib/geometry';
import { traceSmoothPath } from '../lib/path';

interface StrokePathProps {
  stroke: Stroke;
  width: number;
  height: number;
}

export const StrokePath = memo(function StrokePath({ stroke, width, height }: StrokePathProps) {
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    traceSmoothPath(builder, flattenPoints(stroke.points), width, height);
    return builder.build();
  }, [stroke.points, width, height]);

  const isEraser = stroke.tool === 'eraser';

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={brushSizeToPixels(stroke.size, width)}
      strokeCap="round"
      strokeJoin="round"
      color={isEraser ? '#000000' : stroke.color}
      blendMode={isEraser ? 'clear' : 'srcOver'}
    />
  );
});
