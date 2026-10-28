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
import { rich } from '@/components/ui/Rich';
import { tr, type MessageKey } from '@/lib/i18n';

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
      title={tr('conflict.title')}
      footer={
        <>
          <Button variant="secondary" onClick={() => exportBackup(conflict.journal)}>
            <Download className="size-4" /> {tr('conflict.download')}
          </Button>
          <Button variant="primary" onClick={() => window.location.reload()} autoFocus>
            <RotateCw className="size-4" /> {tr('conflict.reload')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-muted">
        <p>{tr('conflict.body')}</p>
        {conflict.copy === undefined ? (
          <p>{tr('conflict.keeping')}</p>
        ) : conflict.copy ? (
          <p>
            {tr('conflict.kept')}
            <span className="num mt-1.5 block break-all rounded-md border border-line bg-app px-3 py-2 text-xs text-fg">
              {conflict.copy}
            </span>
            {rich(tr('conflict.keptOpen'), { b: (text) => <span className="text-fg">{text}</span> })}
          </p>
        ) : (
          <p className="text-loss">{tr('conflict.notKept')}</p>
        )}
        <p>{tr('conflict.reloadHint')}</p>
      </div>
    </Modal>
  );
}

/** why the browser isn't keeping its copy of the journal, in words */
export const WHY_NO_COPY: Record<CopyMiss, MessageKey> = {
  'too-big': 'copy.why.tooBig',
  refused: 'copy.why.refused',
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
  const why = tr(WHY_NO_COPY[copyMiss]);

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
            ? tr('copy.offTooBig')
            : tr('copy.off', { why })
          : saveStatus === 'error'
            ? tr(native ? 'copy.lostErrorNative' : 'copy.lostErrorWeb', { why })
            : tr(native ? 'copy.lostNative' : 'copy.lostWeb', { why })}
      </span>
      <span className="ms-auto flex gap-2">
        {lost && (
          <Button size="sm" variant="secondary" onClick={() => exportBackup(data)}>
            <Download className="size-4" /> {tr('common.downloadBackup')}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSeen((list) => [...list, 'off', ...(lost ? (['lost'] as const) : [])])}
        >
          {tr('common.ok')}
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
  if (recovered === null) return null;

  return (
    <div className="flex items-start gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2 text-sm md:px-6">
      <Info className="mt-0.5 size-4 shrink-0 text-accent" />
      <span className="min-w-0 text-fg">
        {rich(tr('recovered.body', { path: recovered || tr('recovered.backups') }), {
          path: (text) => <span className="num break-all text-muted">{text}</span>,
        })}
      </span>
      <Button size="sm" variant="secondary" className="ms-auto" onClick={dismissRecovered}>
        {tr('common.ok')}
      </Button>
    </div>
  );
}
