'use client';

import { useState } from 'react';
import { CircleAlert, Download, Info, RotateCw } from 'lucide-react';
import { useJournal, useSaveState } from '@/store/JournalProvider';
import type { CopyMiss } from '@/store/mirror';
import { exportBackup } from '@/lib/backup';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * Shown when this window stopped saving because another tab, window or copy
 * of the app saved the journal after this one opened it. It can't be closed:
 * a window that carries on editing would only pile up changes that are never
 * saved. This window's version is kept as a copy first.
 */
export function SaveConflictDialog() {
  const { conflict } = useSaveState();
  if (!conflict) return null;

  return (
    <Modal
      open
      onClose={() => undefined}
      closable={false}
      closeOnBackdrop={false}
      size="sm"
      title="This journal was changed in another window"
      footer={
        <>
          <Button variant="secondary" onClick={() => exportBackup(conflict.journal)}>
            <Download className="size-4" /> Download this window&apos;s version
          </Button>
          <Button variant="primary" onClick={() => window.location.reload()} autoFocus>
            <RotateCw className="size-4" /> Reload
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-muted">
        <p>
          Another tab, window or copy of Sniper Journal saved the journal after this window opened it. So that its work
          isn&apos;t written over, this window has stopped saving.
        </p>
        {conflict.copy === undefined ? (
          <p>Keeping a copy of this window&apos;s version…</p>
        ) : conflict.copy ? (
          <p>
            This window&apos;s version, with the changes made here, was kept as a copy:
            <span className="num mt-1.5 block break-all rounded-md border border-line bg-app px-3 py-2 text-xs text-fg">
              {conflict.copy}
            </span>
            If it is the one you want, open it with <span className="text-fg">Settings → Restore from a backup</span>.
          </p>
        ) : (
          <p className="text-loss">
            This window&apos;s version could not be kept as a copy. Download it before you reload, or the changes made in
            this window are lost.
          </p>
        )}
        <p>Reload to carry on with the journal as it is saved now.</p>
      </div>
    </Modal>
  );
}

/** why the browser isn't keeping its copy of the journal, in words */
export const WHY_NO_COPY: Record<CopyMiss, string> = {
  'too-big': 'the journal is too large for it',
  refused: 'its storage is full or turned off',
};

const native = storage.kind === 'native';

/**
 * Said once a session when the browser can't keep its copy of the journal.
 * Calmly while the file is saved as usual: on a PC the copy is only a spare,
 * for a window closed before its last save. Once more, and not calmly, if
 * changes then aren't saved anywhere; dismissing that one covers both. A
 * phone keeps a copy only while its folder can't be written, so it only ever
 * gets the second.
 */
export function CopyNotice() {
  const { data } = useJournal();
  const { copyMiss, saveStatus } = useSaveState();
  const [seen, setSeen] = useState<Array<'off' | 'lost'>>([]);
  if (!copyMiss || saveStatus === 'conflict') return null;
  const lost = saveStatus === 'unsaved' || saveStatus === 'error';
  if (seen.includes(lost ? 'lost' : 'off') || (native && !lost)) return null;
  const why = WHY_NO_COPY[copyMiss];

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-start gap-3 border-b px-4 py-2 text-sm md:px-6',
        lost ? 'border-loss/25 bg-loss/10' : 'border-accent/25 bg-accent/10',
      )}
    >
      {lost ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-loss" />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-accent" />
      )}
      <span className="min-w-0 flex-1 text-fg">
        {!lost
          ? copyMiss === 'too-big'
            ? 'Your journal is now too large for this browser to keep its spare copy. Nothing else changes: it is still saved to the journal file a moment after every change.'
            : `This browser won't keep a spare copy of your journal (${why}). Nothing else changes: it is still saved to the journal file a moment after every change.`
          : saveStatus === 'error'
            ? `The journal file couldn't be read when the app started, and ${native ? 'the app' : 'this browser'} can't keep your changes either (${why}), so changes made now aren't saved anywhere. Download a backup before you close the app.`
            : `Your latest changes aren't saved anywhere yet: ${native ? "the app can't write its file right now and can't keep a temporary copy" : "the journal file can't be reached and this browser can't keep a copy"} (${why}). They are written as soon as the file can be. To be safe, download a backup before you close the app.`}
      </span>
      <span className="ml-auto flex gap-2">
        {lost && (
          <Button size="sm" variant="secondary" onClick={() => exportBackup(data)}>
            <Download className="size-4" /> Download a backup
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSeen((list) => [...list, 'off', ...(lost ? (['lost'] as const) : [])])}
        >
          OK
        </Button>
      </span>
    </div>
  );
}

/**
 * Shown once when the app found unsaved changes from another window in the
 * browser, made on top of an older journal file, and kept them as a copy
 * rather than opening them over newer work.
 */
export function RecoveredNotice() {
  const { recovered, dismissRecovered } = useSaveState();
  if (!recovered) return null;

  return (
    <div className="flex items-start gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2 text-sm md:px-6">
      <Info className="mt-0.5 size-4 shrink-0 text-accent" />
      <span className="min-w-0 text-fg">
        Changes from another window that never reached the journal file were made on top of an older version, so they
        were kept as a copy instead of being opened: <span className="num break-all text-muted">{recovered}</span>
      </span>
      <Button size="sm" variant="secondary" className="ml-auto" onClick={dismissRecovered}>
        OK
      </Button>
    </div>
  );
}
