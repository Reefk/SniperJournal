import type { JournalData } from './types';
import { dateKey, downloadFile } from './utils';

export function exportBackup(data: JournalData) {
  downloadFile(`sniper-journal-backup-${dateKey(new Date())}.json`, JSON.stringify(data, null, 2));
}

/** Validates a restore file enough to refuse obvious rubbish */
export function parseBackup(text: string): { data?: JournalData; error?: string } {
  try {
    const parsed = JSON.parse(text) as Partial<JournalData>;
    if (!parsed || typeof parsed !== 'object') return { error: 'That file is not a Sniper Journal backup.' };
    if (!Array.isArray(parsed.trades) || !Array.isArray(parsed.accounts)) {
      return { error: 'That file does not contain a trades and accounts list.' };
    }
    return { data: parsed as JournalData };
  } catch {
    return { error: 'That file is not valid JSON.' };
  }
}
