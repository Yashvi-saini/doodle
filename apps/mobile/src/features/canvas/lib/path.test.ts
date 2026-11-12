import { describe, expect, it } from 'vitest';
import { type PathSink, traceSmoothPath } from './path';

function recorder() {
  const calls: string[] = [];
  const sink: PathSink = {
    moveTo: (x, y) => calls.push(`M ${x} ${y}`),
    lineTo: (x, y) => calls.push(`L ${x} ${y}`),
    quadTo: (x1, y1, x2, y2) => calls.push(`Q ${x1} ${y1} ${x2} ${y2}`),
  };
  return { sink, calls };
}

describe('traceSmoothPath', () => {
  it('does nothing for an empty stroke', () => {
    const { sink, calls } = recorder();
    traceSmoothPath(sink, []);
    expect(calls).toEqual([]);
  });

  it('draws a dot for a single tap', () => {
    const { sink, calls } = recorder();
    traceSmoothPath(sink, [0.5, 0.5], 200, 100);
    expect(calls).toEqual(['M 100 50', 'L 100 50']);
  });

  it('curves through midpoints and ends on the last point', () => {
    const { sink, calls } = recorder();
    traceSmoothPath(sink, [0, 0, 10, 0, 10, 10]);
    expect(calls).toEqual(['M 0 0', 'Q 0 0 5 0', 'Q 10 0 10 5', 'L 10 10']);
  });

  it('scales normalised coordinates to pixels', () => {
    const { sink, calls } = recorder();
    traceSmoothPath(sink, [0, 0, 1, 1], 400, 300);
    expect(calls).toEqual(['M 0 0', 'Q 0 0 200 150', 'L 400 300']);
  });
});
