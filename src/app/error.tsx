'use client';

import Link from 'next/link';
import { Download, LayoutDashboard, RotateCw, TriangleAlert } from 'lucide-react';
import { useJournal, useSaveState } from '@/store/JournalProvider';
import { exportBackup } from '@/lib/backup';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n';

/**
 * A page that crashed while drawing. The sidebar, the journal and saving all
 * live above this, so they carry on: only the page is replaced, by this.
 * A crash in those parts themselves is global-error.tsx.
 */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { data } = useJournal();
  const { filePath } = useSaveState();

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-xl border border-line bg-surface p-6">
        <TriangleAlert className="size-6 text-warn" />
        <h1 className="mt-3 text-lg font-semibold text-fg">{tr('error.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{tr('error.body')}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => retry()}>
            <RotateCw className="size-4" /> {tr('error.retry')}
          </Button>
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line bg-raised px-3.5 text-sm font-medium text-fg transition hover:border-line-strong md:h-9"
          >
            <LayoutDashboard className="size-4" /> {tr('error.dashboard')}
          </Link>
          <Button variant="secondary" onClick={() => exportBackup(data)}>
            <Download className="size-4" /> {tr('common.downloadBackup')}
          </Button>
        </div>

        {filePath && (
          <p className="mt-5 text-xs text-muted">
            {tr('common.keptHere')}
            <span className="num mt-1 block break-all rounded-md border border-line bg-app px-3 py-2 text-fg">
              {filePath}
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
    </div>
  );
}
