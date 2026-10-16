'use client';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { useEffect, useState } from 'react';
import type { JournalData } from '@/lib/types';
import { exportBackup } from '@/lib/backup';
import { rescueJournal, rescueTheme } from '@/store/rescue';

/**
 * The app itself crashed: the journal's state, the sidebar or the header.
 * This replaces the whole page and runs without any of the app's providers,
 * so it reads the journal straight from storage (store/rescue.ts) and uses
 * plain elements only, nothing that could be what broke.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [rescue, setRescue] = useState<{ journal: JournalData | null; location: string | null } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('light', rescueTheme() === 'light');
    let cancelled = false;
    rescueJournal().then((found) => {
      if (!cancelled) setRescue(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const button =
    'inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 md:h-9';

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-app text-fg">
        <title>Sniper Journal</title>
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-xl rounded-xl border border-line bg-surface p-6">
            <h1 className="text-lg font-semibold text-fg">Sniper Journal ran into a problem</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Something went wrong and the app couldn&apos;t carry on. Your journal is still saved where it was: nothing
              on this screen changes it. Try again, or download a backup first to be safe.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={`${button} bg-accent-strong text-white`} onClick={() => retry()}>
                Try again
              </button>
              <button
                type="button"
                className={`${button} border border-line bg-raised text-fg`}
                onClick={() => window.location.reload()}
              >
                Reload the app
              </button>
              <button
                type="button"
                className={`${button} border border-line bg-raised text-fg`}
                disabled={!rescue?.journal}
                onClick={() => rescue?.journal && exportBackup(rescue.journal)}
              >
                Download a backup
              </button>
            </div>

            <p className="mt-4 text-xs text-muted">
              {rescue === null
                ? 'Reading your journal…'
                : rescue.journal
                  ? `The backup holds ${rescue.journal.trades?.length ?? 0} ${rescue.journal.trades?.length === 1 ? 'trade' : 'trades'}.`
                  : 'No journal could be read, so there is nothing to download from here.'}
            </p>
            {rescue?.location && (
              <p className="mt-3 text-xs text-muted">
                Your journal is kept here:
                <span className="num mt-1 block break-all rounded-md border border-line bg-app px-3 py-2 text-fg">
                  {rescue.location}
                </span>
              </p>
            )}

            <details className="mt-5 text-xs text-muted">
              <summary className="cursor-pointer select-none">Details for a bug report</summary>
              <pre className="num mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-line bg-app px-3 py-2">
                {error.message || 'No message'}
                {error.digest ? `\n(${error.digest})` : ''}
              </pre>
            </details>
          </div>
        </main>
      </body>
    </html>
  );
}
