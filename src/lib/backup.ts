import { tr } from './i18n';
import { newerJournal } from './journal-version';
import type { JournalData } from './types';
import { dateKey, downloadFile } from './utils';

export function exportBackup(data: JournalData) {
  downloadFile(`sniper-journal-backup-${dateKey(new Date())}.json`, JSON.stringify(data, null, 2));
}

/** Validates a restore file enough to refuse obvious rubbish */
export function parseBackup(text: string): { data?: JournalData; error?: string } {
  try {
    const parsed = JSON.parse(text) as Partial<JournalData>;
    if (!parsed || typeof parsed !== 'object') return { error: tr('backup.notBackup') };
    // restoring it here would quietly drop whatever the newer version added
    if (newerJournal(parsed) != null) {
      return { error: tr('backup.newer') };
    }
    if (!Array.isArray(parsed.trades) || !Array.isArray(parsed.accounts)) {
      return { error: tr('backup.noLists') };
    }
    return { data: parsed as JournalData };
  } catch {
    return { error: tr('backup.notJson') };
  }
}
