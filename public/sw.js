/*
 * A deliberately empty service worker.
 *
 * Chrome wants a fetch handler before it will offer "Install Sniper Journal",
 * and this provides one. It caches nothing and intercepts nothing: every
 * request goes straight to the local server, exactly as it would without a
 * service worker. That is on purpose — caching a journal would risk showing
 * you yesterday's trades.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // no respondWith, so the browser handles the request normally
});
