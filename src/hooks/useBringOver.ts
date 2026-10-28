'use client';

import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { parseBackup } from '@/lib/backup';
import { messagesOf, tr, type MessageKey } from '@/lib/i18n';
import { storage } from '@/lib/storage';

/** the Windows app; the only one that can reach the earlier version's folder */
export const CAN_BRING_OVER = storage.kind === 'native' && storage.device === 'pc';

/**
 * The Windows app's refusals, as it says them in English (src-tauri/src/lib.rs),
 * each with its text here, so they show in the language on screen.
 */
const REFUSALS = new Map<string, MessageKey>(
  (['bring.refused.noJournal', 'bring.refused.unreadable'] as const).map((key) => [messagesOf('en')[key], key]),
);

/** a command's refusal is its message, already worded for the person; one it doesn't know of shows as it came */
export function said(err: unknown): string {
  if (typeof err !== 'string') return tr('bring.folderUnreadable');
  const key = REFUSALS.get(err);
  return key ? tr(key) : err;
}

/**
 * Brings the journal of the earlier PC version (the one that ran its own
 * server, with INSTALLER.bat) into the Windows app: the person picks its
 * folder, the journal is checked like a backup, and its chart images are
 * copied over before it replaces this one. Once past the first run, the
 * journal being replaced is asked about and kept in the backups first, as a
 * restore is.
 */
export function useBringOver() {
  const { data, actions } = useJournal();
  const { confirm, toast } = useUI();

  return async () => {
    let tauri: typeof import('@/lib/storage/tauri');
    let old;
    try {
      // the Windows app's own code, loaded only there (the button is nowhere else)
      tauri = await import('@/lib/storage/tauri');
      old = await tauri.readOldJournal();
    } catch (err) {
      toast(said(err), 'error');
      return;
    }
    if (!old) return;

    const { data: parsed, error } = parseBackup(old.text);
    if (!parsed) {
      toast(error ?? tr('bring.unreadable'), 'error');
      return;
    }

    // on the first run there is nothing yet to lose
    if (data.onboarded) {
      const ok = await confirm({
        title: tr('bring.title'),
        message: tr('bring.message', { count: parsed.trades.length }),
        confirmLabel: tr('settings.restore.confirm'),
        tone: 'danger',
      });
      if (!ok) return;
      try {
        await storage.keepCopy(data, 'before-restore');
      } catch {
        toast(tr('settings.noCopy'), 'error');
        return;
      }
    }

    try {
      await tauri.copyOldImages(old);
    } catch {
      toast(tr('bring.imagesFailed'), 'error');
      return;
    }
    actions.replaceAll(parsed);
    toast(tr('bring.done', { count: parsed.trades.length }));
  };
}
