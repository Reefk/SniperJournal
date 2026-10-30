'use client';

import { FolderOpen, HardDrive, Keyboard, LifeBuoy, ShieldCheck, Upload } from 'lucide-react';
import { useSaveState, type SaveStatus } from '@/store/JournalProvider';
import type { CopyMiss } from '@/store/mirror';
import { WHY_NO_COPY } from '@/components/layout/SaveConflict';
import { PageHeader } from '@/components/ui/PageHeader';
import { storage } from '@/lib/storage';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tr, type MessageKey } from '@/lib/i18n';

/** each shortcut's keys as written on the keyboard (two keys that do the same, or one), and what it does */
const SHORTCUTS: Array<[string | [string, string], MessageKey]> = [
  ['N', 'sup.key.newTrade'],
  [['Ctrl K', '/'], 'sup.key.search'],
  ['Ctrl + Enter', 'sup.key.saveForm'],
  ['Esc', 'sup.key.closeDialog'],
];

/** a question and its answer, as the texts' keys; looked up when the page is drawn */
interface Question {
  q: MessageKey;
  a: MessageKey;
}

const FAQ: Question[] = [
  { q: 'sup.q.where', a: 'sup.a.where' },
  { q: 'sup.q.broken', a: 'sup.a.broken' },
  { q: 'sup.q.missing', a: 'sup.a.missing' },
  { q: 'sup.q.futures', a: 'sup.a.futures' },
  { q: 'sup.q.rMultiple', a: 'sup.a.rMultiple' },
  { q: 'sup.q.window', a: 'sup.a.window' },
  { q: 'sup.q.ownWindow', a: 'sup.a.ownWindow' },
  { q: 'sup.q.computers', a: 'sup.a.computers' },
];

/** by question: its wording and answer in one version, or null where that version doesn't ask it */
type Changes = Partial<Record<MessageKey, { q?: MessageKey; a: MessageKey } | null>>;

/** The phone app answers the same questions, minus everything about Windows and folders */
const PHONE_ANSWERS: Changes = {
  'sup.q.where': { a: 'sup.a.where.phone' },
  'sup.q.broken': { a: 'sup.a.broken.phone' },
  'sup.q.window': null,
  'sup.q.ownWindow': null,
  'sup.q.computers': { q: 'sup.q.computers.phone', a: 'sup.a.computers.phone' },
};

/** The Windows app answers them too, minus the server and the browser */
const WINDOWS_APP_ANSWERS: Changes = {
  'sup.q.where': { a: 'sup.a.where.app' },
  'sup.q.broken': { a: 'sup.a.broken.app' },
  'sup.q.window': { a: 'sup.a.window.app' },
  'sup.q.ownWindow': null,
  'sup.q.computers': { a: 'sup.a.computers.app' },
};

/** asked only of the Windows app */
const WINDOWS_APP_EXTRA: Question[] = [{ q: 'sup.q.bringOver', a: 'sup.a.bringOver' }];

/** what's typed as it is: the commands that start the server version */
const COMMANDS = { start: 'npm start', dev: 'npm run dev' };

const native = storage.kind === 'native';
const phone = storage.device === 'phone';
/** which of a text's two versions this one is: an app's, or the browser's */
const where = native ? 'app' : 'web';

function answered(changes: Changes) {
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
  const why = copyMiss ? tr(WHY_NO_COPY[copyMiss]) : '';
  switch (status) {
    case 'error':
      return copyMiss ? tr(`sup.file.errorLost.${where}`, { why }) : tr(`sup.file.error.${where}`);
    case 'conflict':
      return tr('sup.file.conflict');
    case 'browser':
      return tr(`sup.file.browser.${where}`);
    case 'unsaved':
      return tr(`sup.file.unsaved.${where}`, { why });
    default:
      return copyMiss && !native ? tr('sup.file.savedNoCopy', { why }) : tr('sup.file.saved');
  }
}

export function SupportView() {
  const { filePath, saveStatus, copyMiss } = useSaveState();
  // the answers' numbers, written the language's way
  const answer = { ...COMMANDS, max: formatNumber(7500), lot: formatNumber(100_000) };

  return (
    <>
      <PageHeader title={tr('nav.support')} description={tr('sup.description')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-5">
          <HardDrive className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">{tr('sup.file.title')}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{fileStatus(saveStatus, copyMiss)}</p>
          {filePath && (
            // a path reads left to right, so a leading "/" stays at its start in Arabic
            <p
              dir="ltr"
              className="num mt-3 break-all rounded-md border border-line bg-app px-3 py-2 text-xs text-muted"
            >
              {filePath}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <ShieldCheck className="size-5 text-profit" />
          <h2 className="mt-3 text-sm font-semibold text-fg">{tr(phone ? 'sup.private.phone' : 'sup.private.pc')}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {tr(phone ? 'sup.privateText.phone' : 'sup.privateText.pc')}
          </p>
        </section>

        {/* keyboard shortcuts mean nothing on a touch screen */}
        <section className={cn('rounded-xl border border-line bg-surface p-5', phone && 'hidden')}>
          <Keyboard className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">{tr('sup.shortcuts')}</h2>
          <dl className="mt-3 space-y-2">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-sm text-muted">{tr(label)}</dt>
                <dd>
                  {/* the label wraps, never the keys ("Guardar el formulario de la operación") */}
                  <kbd className="num whitespace-nowrap rounded border border-line bg-app px-1.5 py-0.5 text-[11px] text-fg">
                    {typeof keys === 'string' ? keys : tr('sup.key.either', { first: keys[0], second: keys[1] })}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-surface">
        <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-sm font-semibold text-fg">
          <LifeBuoy className="size-4 text-accent" /> {tr('sup.faq')}
        </h2>
        <div className="divide-y divide-line">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group px-4 py-3.5 md:px-5">
              <summary className="cursor-pointer select-none list-none text-sm font-medium text-fg marker:hidden">
                {/* Arabic draws › as ‹ by itself, so it turns the other way to point down when open */}
                <span className="inline-block transition group-open:rotate-90 rtl:group-open:-rotate-90">›</span>
                <span className="ms-2">{tr(item.q)}</span>
              </summary>
              <p className="ms-5 mt-2 text-sm leading-relaxed text-muted">{tr(item.a, answer)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <Upload className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">{tr('sup.import.title')}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {tr('sup.import.text', { qty: 'qty', ticker: 'ticker', commission: 'commission', pnl: 'realized pnl' })}
          </p>
        </div>
        {/* how to start the server version; the Windows and phone apps just open */}
        <div className={cn('rounded-xl border border-line bg-surface p-5', native && 'hidden')}>
          <FolderOpen className="size-5 text-accent" />
          <h2 className="mt-3 text-sm font-semibold text-fg">{tr('sup.open.title')}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {tr('sup.open.text', { ...COMMANDS, url: 'http://localhost:3000' })}
          </p>
        </div>
      </section>
    </>
  );
}
