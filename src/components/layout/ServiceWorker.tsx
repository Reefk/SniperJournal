'use client';

import { useEffect } from 'react';

/** Registers the empty service worker that makes the app installable in Chrome. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // installing as an app is a convenience; the app works regardless
    });
  }, []);
  return null;
}
