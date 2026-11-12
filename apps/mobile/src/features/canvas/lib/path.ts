export interface PathSink {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  quadTo(x1: number, y1: number, x2: number, y2: number): unknown;
}

export function traceSmoothPath(
  sink: PathSink,
  coords: readonly number[],
  scaleX = 1,
  scaleY = 1,
): void {
  'worklet';
  const count = Math.floor(coords.length / 2);
  if (count === 0) return;

  let previousX = (coords[0] ?? 0) * scaleX;
  let previousY = (coords[1] ?? 0) * scaleY;
  sink.moveTo(previousX, previousY);

  if (count === 1) {
    sink.lineTo(previousX, previousY);
    return;
  }

  for (let index = 1; index < count; index += 1) {
    const x = (coords[index * 2] ?? 0) * scaleX;
    const y = (coords[index * 2 + 1] ?? 0) * scaleY;
    sink.quadTo(previousX, previousY, (previousX + x) / 2, (previousY + y) / 2);
    previousX = x;
    previousY = y;
  }
  sink.lineTo(previousX, previousY);
}
