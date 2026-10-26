'use client';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { useEffect, useState } from 'react';
import type { JournalData } from '@/lib/types';
import { exportBackup } from '@/lib/backup';
import { rescueJournal, rescueTheme } from '@/store/rescue';
import { language, setLanguage, tr } from '@/lib/i18n';
import { rememberedLanguage } from '@/store/language';

/**
 * The app itself crashed: the journal's state, the sidebar or the header.
 * This replaces the whole page and runs without any of the app's providers,
 * so it reads the journal straight from storage (store/rescue.ts) and uses
 * plain elements only, nothing that could be what broke.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [rescue, setRescue] = useState<{ journal: JournalData | null; location: string | null } | null>(null);
  // the language the app spoke, or if it crashed before speaking one, the one the journal was
  // last shown in (English until that is known: it is drawn first without it)
  const [spoken] = useState(() => {
    if (typeof window !== 'undefined' && language().code === 'en') setLanguage(rememberedLanguage());
    return language();
  });

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
    <html lang={spoken.code} dir={spoken.dir} suppressHydrationWarning>
      <body className="bg-app text-fg">
        <title>Sniper Journal</title>
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-xl rounded-xl border border-line bg-surface p-6">
            <h1 className="text-lg font-semibold text-fg">{tr('error.app.title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{tr('error.app.body')}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={`${button} bg-accent-strong text-white`} onClick={() => retry()}>
                {tr('error.retry')}
              </button>
              <button
                type="button"
                className={`${button} border border-line bg-raised text-fg`}
                onClick={() => window.location.reload()}
              >
                {tr('error.app.reload')}
              </button>
              <button
                type="button"
                className={`${button} border border-line bg-raised text-fg`}
                disabled={!rescue?.journal}
                onClick={() => rescue?.journal && exportBackup(rescue.journal)}
              >
                {tr('common.downloadBackup')}
              </button>
            </div>

            <p className="mt-4 text-xs text-muted">
              {rescue === null
                ? tr('error.app.reading')
                : rescue.journal
                  ? tr('error.app.holds', { count: rescue.journal.trades?.length ?? 0 })
                  : tr('error.app.nothing')}
            </p>
            {rescue?.location && (
              <p className="mt-3 text-xs text-muted">
                {tr('common.keptHere')}
                <span className="num mt-1 block break-all rounded-md border border-line bg-app px-3 py-2 text-fg">
                  {rescue.location}
                </span>
              </p>
            )}

            <details className="mt-5 text-xs text-muted">
              <summary className="cursor-pointer select-none">{tr('error.details')}</summary>
              <pre className="num mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-line bg-app px-3 py-2">
                {error.message || tr('error.noMessage')}
                {error.digest ? `\n(${error.digest})` : ''}
              </pre>
            </details>
          </div>
        </main>
      </body>
    </html>
  );
}
