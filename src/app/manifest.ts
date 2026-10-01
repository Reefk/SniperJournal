import type { MetadataRoute } from 'next';

/**
 * Lets Chrome install Sniper Journal as a real app: its own window with no
 * address bar, its own icon in the Start menu and on the taskbar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sniper Journal',
    short_name: 'Sniper Journal',
    description: 'Your trading journal and performance analytics, kept on this computer.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#0b1120',
    theme_color: '#0b1120',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
