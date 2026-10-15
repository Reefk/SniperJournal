'use client';

import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { parseBackup } from '@/lib/backup';
import { storage } from '@/lib/storage';
import { copyOldImages, readOldJournal } from '@/lib/storage/tauri';

/** the Windows app; the only one that can reach the earlier version's folder */
export const CAN_BRING_OVER = storage.kind === 'native' && storage.device === 'pc';

/** a command's refusal is its message, already worded for the person */
const said = (err: unknown) => (typeof err === 'string' ? err : 'That folder could not be read.');

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
    let old;
    try {
      old = await readOldJournal();
    } catch (err) {
      toast(said(err), 'error');
      return;
    }
    if (!old) return;

    const { data: parsed, error } = parseBackup(old.text);
    if (!parsed) {
      toast(error ?? 'That journal could not be read.', 'error');
      return;
    }

    // on the first run there is nothing yet to lose
    if (data.onboarded) {
      const ok = await confirm({
        title: 'Bring over this journal?',
        message: `The earlier version's journal holds ${parsed.trades.length} trades. Bringing it over replaces everything currently in your journal. The one it replaces is kept in your backups, without its chart images.`,
        confirmLabel: 'Replace my journal',
        tone: 'danger',
      });
      if (!ok) return;
      try {
        await storage.keepCopy(data, 'before-restore');
      } catch {
        toast('Could not keep a copy of your current journal first, so nothing was changed.', 'error');
        return;
      }
    }

    try {
      await copyOldImages(old);
    } catch {
      toast("The earlier version's chart images could not be copied, so nothing was changed.", 'error');
      return;
    }
    actions.replaceAll(parsed);
    toast(`Brought over ${parsed.trades.length} trades from the earlier version. Its folder was left as it was.`);
  };
}
