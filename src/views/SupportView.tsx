'use client';

import { FolderOpen, HardDrive, Keyboard, LifeBuoy, ShieldCheck, Upload } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
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
    a: 'In a plain JSON file at data/journal.json inside the Sniper Journal folder on this PC. Nothing is uploaded anywhere, and the app works with your internet disconnected. A copy is also mirrored into this browser so your work survives if the app is closed mid-edit.',
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
    a: 'No. The app runs as a hidden background server that starts with Windows, so it is always there when you want it. If you ever need to shut it down, double-click stop.bat in the app folder; autostart-off.bat stops it launching at sign-in. Nothing is lost by stopping it, because your journal is written to disk within a third of a second of every change.',
  },
  {
    q: 'Can I open it in its own window instead of a browser tab?',
    a: 'Yes. In Chrome, click the three dots at the top right, choose Cast, save and share, then Install page as app. Sniper Journal gets its own window with no address bar, plus an icon in the Start menu and on the taskbar. It is the same app either way, using the same journal file.',
  },
  {
    q: 'Why did Windows warn me the first time?',
    a: "Windows marks every file that arrives from the internet and warns before running a script it has not seen signed by a paid-for certificate. Part of the installer's job is clearing that mark from every file in the app folder, which is why the warning appears once and then never again. You can avoid it entirely next time by ticking Unblock in the ZIP file's properties before extracting it.",
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
  'Why did Windows warn me the first time?': null,
  'Can I run this on more than one computer?': {
    q: 'Can I use it on more than one device?',
    a: 'Each phone and each computer keeps its own journal. To move yours, save a backup on one device and restore it on the other from Settings.',
  },
};

const native = storage.kind === 'native';

const QUESTIONS = native
  ? FAQ.flatMap((item) => {
      if (!(item.q in PHONE_ANSWERS)) return [item];
      const phone = PHONE_ANSWERS[item.q];
      return phone ? [{ q: phone.q ?? item.q, a: phone.a }] : [];
    })
  : FAQ;

export function SupportView() {
  const { filePath, saveStatus } = useJournal();

  return (
    <>
      <PageHeader title="Support" description="How Sniper Journal works, and where your data lives." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-5">
          <HardDrive className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">Your journal file</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {saveStatus === 'browser'
              ? native
                ? 'The app cannot write its file right now, so changes are being kept temporarily. They will be written as soon as it can.'
                : 'The app cannot reach its file right now, so changes are being kept in this browser only. They will be written to disk as soon as it is reachable again.'
              : 'Saved automatically a moment after every change.'}
          </p>
          {filePath && (
            <p className="num mt-3 break-all rounded-md border border-line bg-app px-3 py-2 text-xs text-muted">
              {filePath}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <ShieldCheck className="size-5 text-profit" />
          <h2 className="mt-3 text-sm font-semibold text-fg">Nothing leaves this {native ? 'phone' : 'PC'}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            There is no account, no server and no telemetry. The app only talks to its own folder on this{' '}
            {native ? 'phone' : 'machine'}, which is why it keeps working with the network off.
          </p>
        </section>

        {/* keyboard shortcuts mean nothing on a touch screen */}
        <section className={cn('rounded-xl border border-line bg-surface p-5', native && 'hidden')}>
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
            Open Trades, choose Import CSV and download the template to see the exact column names. Common broker
            headings such as qty, ticker, commission and realized pnl are recognised automatically, and any rows that
            cannot be read are listed before you commit the import.
          </p>
        </div>
        {/* how to start the background server on Windows; a phone app just opens */}
        <div className={cn('rounded-xl border border-line bg-surface p-5', native && 'hidden')}>
          <FolderOpen className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">Opening the app</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            It is already open, in a sense: the app runs in the background from the moment you sign in to Windows. Click
            the Sniper Journal icon on your desktop, or the installed app icon, and it appears. If the icon is missing,
            run create-shortcut.bat in the app folder.
          </p>
        </div>
      </section>
    </>
  );
}
