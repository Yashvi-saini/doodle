import { useEffect, useState } from 'react';

/** Whole seconds left until `endsAt` (epoch ms), ticking a few times a second. */
export function useCountdown(endsAt: number | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
