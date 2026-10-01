'use client';

import { useEffect, useState } from 'react';

/** Ticking clock that only starts on the client, so SSR and the first paint agree */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date(0));
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
