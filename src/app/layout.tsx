import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { JournalProvider } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Sniper Journal',
  description: 'A trading journal and performance analytics desktop app that keeps your data on your own PC.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <JournalProvider>
          <UIProvider>
            <AppShell>{children}</AppShell>
          </UIProvider>
        </JournalProvider>
      </body>
    </html>
  );
}
