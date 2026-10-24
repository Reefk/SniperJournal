'use client';

import { FolderOpen, HardDrive, Keyboard, LifeBuoy, ShieldCheck, Upload } from 'lucide-react';
import { useSaveState, type SaveStatus } from '@/store/JournalProvider';
import type { CopyMiss } from '@/store/mirror';
import { WHY_NO_COPY } from '@/components/layout/SaveConflict';
import { PageHeader } from '@/components/ui/PageHeader';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/utils';

const SHORTCUTS = [
  ['N', 'Log a new trade'],
  ['Ctrl K  or  /', 'Jump to search'],
  ['Ctrl + Enter', 'Save the trade form'],
  ['Esc', 'Close a dialog'],
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Where exactly is my data kept?',
    a: 'In a plain JSON file at data/journal.json inside the Sniper Journal folder on this PC. Nothing is uploaded anywhere, and the app works with your internet disconnected. A copy is also mirrored into this browser so your work survives if the app is closed mid-edit, as long as the journal fits in the browser (up to about 7,500 trades).',
  },
  {
    q: 'What happens if I break something?',
    a: 'Every day that you make a change, the previous version of the file is copied into data/backups before the new one is written. The last 30 daily copies are kept. You can also download a backup at any time from your profile menu, and restore it from Settings.',
  },
  {
    q: 'Why is a trade missing from my statistics?',
    a: 'Statistics only count closed trades, so anything without an exit price or a manual P&L is left out until you close it. Trades you marked with the eye icon are also deliberately excluded while staying in the journal.',
  },
  {
    q: 'How do I log futures or forex properly?',
    a: 'Open the "Futures, forex and manual P&L" section in the trade form and set the contract multiplier: ES is 50, NQ is 20, MES is 5, and one standard forex lot is 100,000 units. If it is easier, switch P&L to manual and paste the figure from your broker instead.',
  },
  {
    q: 'What counts as an R multiple?',
    a: 'Your result divided by the money you had at risk between entry and stop loss. Trades logged without a stop cannot be measured in R, which is why the risk and R:R statistics ask you to record one.',
  },
  {
    q: 'Do I need to keep a window open for this to work?',
    a: 'Yes, the one where you ran npm start (or npm run dev): that is the server, and the page needs it. Nothing is lost by stopping it, because your journal is written to disk within a third of a second of every change.',
  },
  {
    q: 'Can I open it in its own window instead of a browser tab?',
    a: 'Yes. In Chrome, click the three dots at the top right, choose Cast, save and share, then Install page as app. Sniper Journal gets its own window with no address bar, plus an icon in the Start menu and on the taskbar. It is the same app either way, using the same journal file.',
  },
  {
    q: 'Can I run this on more than one computer?',
    a: 'Each installation keeps its own file. To move your journal, download a backup from one machine and restore it on the other from Settings.',
  },
];

/** The phone app answers the same questions, minus everything about Windows and folders */
const PHONE_ANSWERS: Record<string, { q?: string; a: string } | null> = {
  'Where exactly is my data kept?': {
    a: 'In the app’s own private storage on this phone. Nothing is uploaded anywhere, there is no account, and the app works with the network off. Other apps cannot read it, and uninstalling the app deletes it, so save a backup somewhere else now and then.',
  },
  'What happens if I break something?': {
    a: 'Every day that you make a change, the previous version of your journal is copied aside inside the app before the new one is written, and the last 30 daily copies are kept. You can also save a backup at any time from More → Back up your journal, and restore it from Settings.',
  },
  'Do I need to keep a window open for this to work?': null,
  'Can I open it in its own window instead of a browser tab?': null,
  'Can I run this on more than one computer?': {
    q: 'Can I use it on more than one device?',
    a: 'Each phone and each computer keeps its own journal. To move yours, save a backup on one device and restore it on the other from Settings.',
  },
};

/** The Windows app answers them too, minus the server and the browser */
const WINDOWS_APP_ANSWERS: Record<string, { q?: string; a: string } | null> = {
  'Where exactly is my data kept?': {
    a: 'In a plain JSON file, journal.json, in the Sniper Journal folder in your Documents. The app uploads nothing and works with your internet disconnected (if OneDrive backs up your Documents, it backs up the journal too). The folder stays when you uninstall the app, so reinstalling picks your journal up again.',
  },
  'What happens if I break something?': {
    a: 'Every day that you make a change, the previous version of the file is copied into the backups folder next to it before the new one is written. The last 30 daily copies are kept. You can also save a backup at any time from your profile menu, and restore it from Settings.',
  },
  'Do I need to keep a window open for this to work?': {
    a: 'Only while you use it. Every change is written to disk within a third of a second, and closing the window waits for the last one, so nothing is lost when you close it.',
  },
  'Can I open it in its own window instead of a browser tab?': null,
  'Can I run this on more than one computer?': {
    a: 'Each computer keeps its own journal. To move yours, save a backup on one computer and restore it on the other from Settings, and copy the screenshots folder across for its chart images.',
  },
};

/** asked only of the Windows app */
const WINDOWS_APP_EXTRA = [
  {
    q: 'I used the earlier version. How do I bring my journal over?',
    a: 'In Settings, under Backups, choose Bring over from the earlier version, then pick the folder you installed it in (the one with INSTALLER.bat). Your trades and chart images are copied over, and the old folder is left exactly as it was.',
  },
];

const native = storage.kind === 'native';
const phone = storage.device === 'phone';

function answered(changes: Record<string, { q?: string; a: string } | null>) {
  return FAQ.flatMap((item) => {
    if (!(item.q in changes)) return [item];
    const changed = changes[item.q];
    return changed ? [{ q: changed.q ?? item.q, a: changed.a }] : [];
  });
}

const QUESTIONS = phone
  ? answered(PHONE_ANSWERS)
  : native
    ? [...answered(WINDOWS_APP_ANSWERS), ...WINDOWS_APP_EXTRA]
    : FAQ;

/** what happened to the latest changes, in words */
function fileStatus(status: SaveStatus, copyMiss: CopyMiss | null): string {
  const why = copyMiss ? WHY_NO_COPY[copyMiss] : '';
  switch (status) {
    case 'error':
      return copyMiss
        ? `The journal file could not be read when the app started, so it is being left exactly as it is rather than saved over. ${native ? 'The app' : 'This browser'} can't keep your changes either (${why}), so changes made now are not saved anywhere. Download a backup before you close the app, then close and reopen it to try again.`
        : `The journal file could not be read when the app started, so it is being left exactly as it is rather than saved over. Your changes are kept ${native ? 'temporarily' : 'in this browser'} for now. Close and reopen the app to try again. If this keeps happening, restore your latest backup in Settings.`;
    case 'conflict':
      return 'Another tab, window or copy of the app saved the journal after this window opened it, so this window stopped saving rather than writing over that work. Its own version was kept as a copy in your backups. Reload to carry on.';
    case 'browser':
      return native
        ? 'The app cannot write its file right now, so changes are being kept temporarily. They will be written as soon as it can.'
        : 'The app cannot reach its file right now, so changes are being kept in this browser only. They will be written to disk as soon as it is reachable again.';
    case 'unsaved':
      return native
        ? `The app cannot write its file right now and can't keep a temporary copy either (${why}), so your latest changes are not saved anywhere yet. Keep the app open: they will be written as soon as it can. To be safe, save a backup.`
        : `The app cannot reach its file right now and this browser can't keep a copy either (${why}), so your latest changes are not saved anywhere yet. Keep the app open: they will be written to disk as soon as the file is reachable again. To be safe, download a backup.`;
    default:
      return copyMiss && !native
        ? `Saved automatically a moment after every change. The spare copy in this browser is off: ${why}.`
        : 'Saved automatically a moment after every change.';
  }
}

export function SupportView() {
  const { filePath, saveStatus, copyMiss } = useSaveState();

  return (
    <>
      <PageHeader title="Support" description="How Sniper Journal works, and where your data lives." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-5">
          <HardDrive className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">Your journal file</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{fileStatus(saveStatus, copyMiss)}</p>
          {filePath && (
            <p className="num mt-3 break-all rounded-md border border-line bg-app px-3 py-2 text-xs text-muted">
              {filePath}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <ShieldCheck className="size-5 text-profit" />
          <h2 className="mt-3 text-sm font-semibold text-fg">Nothing leaves this {phone ? 'phone' : 'PC'}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            There is no account, no server and no telemetry. The app only talks to its own folder on this{' '}
            {phone ? 'phone' : 'machine'}, which is why it keeps working with the network off.
          </p>
        </section>

        {/* keyboard shortcuts mean nothing on a touch screen */}
        <section className={cn('rounded-xl border border-line bg-surface p-5', phone && 'hidden')}>
          <Keyboard className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">Shortcuts</h2>
          <dl className="mt-3 space-y-2">
            {SHORTCUTS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <dt className="text-sm text-muted">{label}</dt>
                <dd>
                  <kbd className="num rounded border border-line bg-app px-1.5 py-0.5 text-[11px] text-fg">{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-surface">
        <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-sm font-semibold text-fg">
          <LifeBuoy className="size-4 text-accent" /> Common questions
        </h2>
        <div className="divide-y divide-line">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group px-4 py-3.5 md:px-5">
              <summary className="cursor-pointer select-none list-none text-sm font-medium text-fg marker:hidden">
                <span className="inline-block transition group-open:rotate-90">›</span>
                <span className="ml-2">{item.q}</span>
              </summary>
              <p className="ml-5 mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <Upload className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">Importing from your broker</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Open Trades and choose Import. The exports of 30 platforms, CSV or Excel, import as they come, and the
            import window says which file to export from each. For anything else, download the template to see the
            column names: common broker headings such as qty, ticker, commission and realized pnl are recognised
            automatically, and any rows that cannot be read are listed before you commit the import.
          </p>
        </div>
        {/* how to start the server version; the Windows and phone apps just open */}
        <div className={cn('rounded-xl border border-line bg-surface p-5', native && 'hidden')}>
          <FolderOpen className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">Opening the app</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            This is the version served from the project folder: run npm start there (npm run dev while you edit the
            code), then open http://localhost:3000. The Windows app from the Microsoft Store and the Android app open
            like any other app.
          </p>
        </div>
      </section>
    </>
  );
}
