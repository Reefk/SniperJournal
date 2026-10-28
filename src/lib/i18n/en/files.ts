import type { Message } from '../types';

/**
 * The journal's files: a backup being restored, the earlier version's
 * journal being brought over, chart images being saved or reclaimed, and the
 * phone's share sheet. Mostly what is said when one of them fails.
 */
export const files = {
  // a file picked to restore that can't be (Settings → Restore, and Bring over)
  'backup.notBackup': 'That file is not a Sniper Journal backup.',
  'backup.newer': 'This backup was made by a newer version of Sniper Journal. Update the app, then restore it.',
  'backup.noLists': 'That file does not contain a trades and accounts list.',
  'backup.notJson': 'That file is not valid JSON.',

  // Bring over: the Windows app takes in the journal of the earlier version, the one that ran its own server
  'bring.title': 'Bring over this journal?',
  'bring.message': {
    one: "The earlier version's journal holds {count} trade. Bringing it over replaces everything currently in your journal. The one it replaces is kept in your backups, without its chart images.",
    other:
      "The earlier version's journal holds {count} trades. Bringing it over replaces everything currently in your journal. The one it replaces is kept in your backups, without its chart images.",
  },
  'bring.done': {
    one: 'Brought over {count} trade from the earlier version. Its folder was left as it was.',
    other: 'Brought over {count} trades from the earlier version. Its folder was left as it was.',
  },
  'bring.imagesFailed': "The earlier version's chart images could not be copied, so nothing was changed.",
  'bring.unreadable': 'That journal could not be read.',
  'bring.folderUnreadable': 'That folder could not be read.',
  // the Windows app's own refusals, word for word as src-tauri/src/lib.rs says them in English
  'bring.refused.noJournal':
    'There is no journal in that folder. Choose the Sniper Journal folder you installed before, the one with INSTALLER.bat in it.',
  'bring.refused.unreadable': 'The journal in that folder could not be read.',

  // a chart image that can't be saved
  'img.notImage': 'That file is not an image.',
  'img.unsupported': 'Only PNG, JPEG, WebP and GIF images can be saved.',
  'img.unreadable': 'Could not read the image.',
  'img.unreachable': 'Images can only be saved while the app can reach its data folder.',

  // Settings → Reclaim unused chart images, stopped before deleting anything;
  // screenshots and backups are the folders' names on disk; file: a backup's file name
  'sweep.shotsUnreadable': 'The screenshots folder could not be read, so no chart image was deleted.',
  'sweep.backupsUnreadable': 'The backups folder could not be read, so no chart image was deleted.',
  'sweep.journalUnreadable': 'Your journal file could not be read, so no chart image was deleted.',
  'sweep.journalDamaged': 'Your journal file is damaged (it is not a complete journal), so no chart image was deleted.',
  'sweep.backupUnreadable': 'The backup {file} could not be read, so no chart image was deleted.',
  'sweep.backupDamaged': 'The backup {file} is damaged (it is not a complete journal), so no chart image was deleted.',

  // the phone's share sheet, for an export or a backup; file: its name
  'share.title': 'Save or send {file}',
  // in recovered.body, where the copy went when the app can't say which file it is
  'recovered.backups': 'your backups',
  // put in a merged trade's notes, followed by the parts' other chart links
  'merge.chartLinks': 'Chart links of the merged parts:',
} satisfies Record<string, Message>;
