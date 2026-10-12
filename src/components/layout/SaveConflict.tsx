'use client';

import { Download, Info, RotateCw } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { exportBackup } from '@/lib/backup';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * Shown when this window stopped saving because another tab, window or copy
 * of the app saved the journal after this one opened it. It can't be closed:
 * a window that carries on editing would only pile up changes that are never
 * saved. This window's version is kept as a copy first.
 */
export function SaveConflictDialog() {
  const { conflict } = useJournal();
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

/**
 * Shown once when the app found unsaved changes from another window in the
 * browser, made on top of an older journal file, and kept them as a copy
 * rather than opening them over newer work.
 */
export function RecoveredNotice() {
  const { recovered, dismissRecovered } = useJournal();
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
