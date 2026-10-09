'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { storage } from '@/lib/storage';

// a dialog or sheet, a dropdown menu, or the search box open over the header
const somethingOpen = () =>
  Boolean(
    document.querySelector('[data-modal-root]') ||
      document.querySelector('[data-popover]') ||
      document.activeElement?.closest('header input'),
  );

/**
 * Android's back button, the way a phone user expects it to behave: close
 * whatever is open on top, otherwise retrace the pages visited, then return to
 * the Dashboard, and only leave the app from there. Without a handler the
 * button simply closes the app, wherever you are in it.
 *
 * "Close whatever is open" reuses the Escape key: dialogs, menus and the
 * search box already close on Escape, so a back press sends one to them.
 *
 * The pages are tracked here rather than asked of the WebView, because the
 * WebView does not count the app's own page changes as history it can go back
 * through.
 */
export function useAndroidBack() {
  const pathname = usePathname();
  const router = useRouter();
  const trail = useRef<string[]>([]);

  useEffect(() => {
    const t = trail.current;
    if (t.length > 1 && t[t.length - 2] === pathname) t.pop();
    else if (t[t.length - 1] !== pathname) t.push(pathname);
  }, [pathname]);

  useEffect(() => {
    if (storage.kind !== 'native') return;

    const listener = App.addListener('backButton', () => {
      if (somethingOpen()) {
        const target = document.activeElement ?? document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      if (trail.current.length > 1) {
        window.history.back();
      } else if (window.location.pathname !== '/') {
        trail.current = [];
        router.replace('/');
      } else {
        void App.exitApp();
      }
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [router]);
}
