import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { JournalProvider } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { AppShell } from '@/components/layout/AppShell';
import { ServiceWorker } from '@/components/layout/ServiceWorker';

export const metadata: Metadata = {
  title: 'Sniper Journal',
  description: 'A trading journal and performance analytics desktop app that keeps your data on your own PC.',
  applicationName: 'Sniper Journal',
  appleWebApp: { capable: true, title: 'Sniper Journal', statusBarStyle: 'black-translucent' },
};

/** the window chrome of the installed app follows the app's own background */
export const viewport: Viewport = {
  // on a phone the app draws under the status bar and pads itself (pt-safe / pb-safe)
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ServiceWorker />
        <JournalProvider>
          <UIProvider>
            <AppShell>{children}</AppShell>
          </UIProvider>
        </JournalProvider>
      </body>
    </html>
  );
}
