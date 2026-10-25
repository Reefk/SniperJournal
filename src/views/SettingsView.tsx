'use client';

import { useRef, useState } from 'react';
import {
  Download,
  FlaskConical,
  FolderInput,
  ImageMinus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { exportBackup, parseBackup } from '@/lib/backup';
import { CURRENCIES, formatBytes, formatMoney } from '@/lib/format';
import { editedMistakes, mistakeList } from '@/lib/mistakes';
import type { EditedRule } from '@/lib/rules';
import { findUnusedCharts, removeUnusedCharts } from '@/lib/screenshots';
import { toNumberOrNull } from '@/lib/utils';
import { storage, type CopyReason } from '@/lib/storage';
import { CAN_BRING_OVER, useBringOver } from '@/hooks/useBringOver';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { TagManager } from '@/components/settings/TagManager';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="border-b border-line px-4 py-4 md:px-5">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </header>
      <div className="px-4 py-4 md:px-5">{children}</div>
    </section>
  );
}

const native = storage.kind === 'native';
const phone = storage.device === 'phone';

export function SettingsView() {
  const { data, actions, balances, sampleCount } = useJournal();
  const { confirm, toast } = useUI();
  const fileInput = useRef<HTMLInputElement>(null);
  const [newAccount, setNewAccount] = useState('');
  const [reclaiming, setReclaiming] = useState(false);
  const [editingMistakes, setEditingMistakes] = useState(false);
  const bringOver = useBringOver();
  const currency = data.settings.currency;
  const mistakes = mistakeList(data.settings);

  const restore = async (file: File | undefined) => {
    if (!file) return;
    const { data: parsed, error } = parseBackup(await file.text());
    if (!parsed) {
      toast(error ?? 'Could not read that file', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Restore this backup?',
      message: `The backup holds ${parsed.trades.length} ${parsed.trades.length === 1 ? 'trade' : 'trades'}. Restoring replaces everything currently in your journal, and deletes the chart images that the backup's trades don't use.`,
      confirmLabel: 'Replace my journal',
      tone: 'danger',
    });
    if (ok) {
      // the journal being replaced must stay recoverable, so no copy, no restore
      if (!(await keepCurrent('before-restore'))) return;
      actions.replaceAll(parsed);
      toast('Journal restored. The one it replaced was kept in your backups, without its chart images.');
    }
  };

  /** a dated copy of the journal as it is now; false (and a message) when that fails */
  const keepCurrent = async (reason: CopyReason): Promise<boolean> => {
    try {
      await storage.keepCopy(data, reason);
      return true;
    } catch {
      toast('Could not keep a copy of your current journal first, so nothing was changed.', 'error');
      return false;
    }
  };

  const reclaimCharts = async () => {
    setReclaiming(true);
    try {
      const unused = await findUnusedCharts(data.trades);
      if (!unused.length) {
        toast('Every chart image is still in use. There is nothing to reclaim.');
        return;
      }
      const one = unused.length === 1;
      const ok = await confirm({
        title: `Delete ${unused.length} unused chart ${one ? 'image' : 'images'}?`,
        message: `No trade in your journal and no copy in your backups uses ${one ? 'it' : 'them'}. Deleting ${one ? 'it' : 'them'} frees ${formatBytes(unused.reduce((a, i) => a + i.bytes, 0))}.`,
        confirmLabel: one ? 'Delete it' : 'Delete them',
        tone: 'danger',
      });
      if (!ok) return;
      // only what was shown and agreed to, even if more became unused meanwhile
      const removed = await removeUnusedCharts(
        data.trades,
        unused.map((i) => i.name),
      );
      toast(
        removed.length
          ? `${formatBytes(removed.reduce((a, i) => a + i.bytes, 0))} freed: ${removed.length} unused chart ${removed.length === 1 ? 'image' : 'images'} deleted.`
          : 'Nothing was deleted: the images are in use again, or could not be removed.',
      );
    } catch (err) {
      // a plain Error carries the storage's own explanation (a damaged journal,
      // a backup it could not read); anything else (a failed fetch, an
      // unreadable reply) means the data folder was out of reach
      toast(
        err instanceof Error && err.name === 'Error' && err.message
          ? err.message
          : 'The app could not reach its data folder, so no chart image was deleted.',
        'error',
      );
    } finally {
      setReclaiming(false);
    }
  };

  const deleteAccount = async (id: string, name: string) => {
    const count = data.trades.filter((t) => t.accountId === id).length;
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: count
        ? `This permanently deletes the account and its ${count} ${count === 1 ? 'trade' : 'trades'}.`
        : 'This account has no trades.',
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    if (ok) {
      actions.deleteAccount(id);
      toast('Account deleted');
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Accounts, currency and your data." />

      <div className="grid max-w-5xl gap-4">
        <Section title="Profile and display">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Your name">
              <Input
                value={data.profile.name}
                onChange={(e) => actions.updateProfile({ name: e.target.value })}
                placeholder="Shown in the header"
              />
            </Field>
            <Field label="Currency" hint="used for every figure">
              <Select value={currency} onChange={(e) => actions.updateSettings({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Theme">
              <Select
                value={data.settings.theme}
                onChange={(e) => actions.updateSettings({ theme: e.target.value as 'dark' | 'light' })}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </Select>
            </Field>
            <Field label="Example text in empty fields">
              <Select
                value={data.settings.fadedPlaceholders === true ? 'faded' : 'clear'}
                onChange={(e) => actions.updateSettings({ fadedPlaceholders: e.target.value === 'faded' })}
              >
                <option value="clear">Clear, easy to read</option>
                <option value="faded">Faded, never looks filled in</option>
              </Select>
            </Field>
          </div>
        </Section>

        <Section
          title="Risk limits"
          description="Used by the signals on the Insights page. Leave blank to turn a limit off."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Maximum loss in a day" hint={currency}>
              <Input
                inputMode="decimal"
                className="num"
                value={data.settings.maxDailyLoss ?? ''}
                onChange={(e) => actions.updateSettings({ maxDailyLoss: toNumberOrNull(e.target.value) })}
                placeholder="e.g. 500"
              />
            </Field>
            <Field label="Maximum trades in a day">
              <Input
                inputMode="numeric"
                className="num"
                value={data.settings.maxTradesPerDay ?? ''}
                onChange={(e) => actions.updateSettings({ maxTradesPerDay: toNumberOrNull(e.target.value) })}
                placeholder="e.g. 3"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Mistakes"
          description="The ones the trade form offers to tap. Reports work out what each one cost you."
        >
          {mistakes.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Your mistakes">
              {mistakes.map((mistake) => (
                <li key={mistake} className="rounded-md border border-line bg-app px-2.5 py-1 text-xs text-muted">
                  {mistake}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">The list is empty, so the trade form offers none.</p>
          )}
          <Button className="mt-3" onClick={() => setEditingMistakes(true)}>
            <Pencil className="size-4" /> Edit the list
          </Button>
        </Section>

        <Section
          title="Tags"
          description="Every tag on your trades, in every account. Renaming, merging or deleting one changes every trade that has it."
        >
          <TagManager />
        </Section>

        <Section title="Accounts" description="Each account keeps its own trades, balance and statistics.">
          <ul className="divide-y divide-line">
            {data.accounts.map((account) => (
              // phone: name and balance on the first line, the starting balance below
              <li key={account.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 md:flex-nowrap">
                <Wallet className="size-4 shrink-0 text-faint" />
                <Input
                  className="min-w-0 flex-1 md:max-w-[220px]"
                  value={account.name}
                  onChange={(e) => actions.updateAccount(account.id, { name: e.target.value })}
                  aria-label="Account name"
                />
                <div className="flex items-center gap-2 max-md:order-last max-md:w-full max-md:pl-7">
                  <span className="text-xs text-muted max-md:whitespace-nowrap">Starting balance</span>
                  <Input
                    className="num w-32"
                    inputMode="decimal"
                    value={account.startingBalance}
                    onChange={(e) =>
                      actions.updateAccount(account.id, { startingBalance: toNumberOrNull(e.target.value) ?? 0 })
                    }
                    aria-label="Starting balance"
                  />
                </div>
                <div className="ml-auto flex items-center gap-4">
                  <div className="text-right">
                    <div className="num text-sm font-medium text-fg">
                      {formatMoney(balances[account.id] ?? 0, currency)}
                    </div>
                    <div className="text-[11px] text-faint">
                      {data.trades.filter((t) => t.accountId === account.id).length} trades
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:bg-loss/10 hover:text-loss"
                    disabled={data.accounts.length === 1}
                    title={data.accounts.length === 1 ? 'You need at least one account' : 'Delete this account'}
                    onClick={() => deleteAccount(account.id, account.name)}
                    aria-label={`Delete ${account.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex items-end gap-2 border-t border-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newAccount.trim()) return;
              actions.addAccount(newAccount.trim(), 0);
              toast(`Account "${newAccount.trim()}" created`);
              setNewAccount('');
            }}
          >
            <Field label="Add an account" className="max-w-xs flex-1">
              <Input
                value={newAccount}
                onChange={(e) => setNewAccount(e.target.value)}
                placeholder="e.g. Prop firm challenge"
              />
            </Field>
            <Button type="submit">
              <Plus className="size-4" /> Add
            </Button>
          </form>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0"
              checked={data.settings.countExcludedInBalance === true}
              onChange={(e) => actions.updateSettings({ countExcludedInBalance: e.target.checked })}
            />
            <span>
              <span className="text-fg">Count excluded trades in the balance</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Off: a trade you exclude with the eye icon is left out of the balance as well as the statistics. On: the
                balance counts it, so it matches your broker&apos;s statement. Win rate, net profit, the equity curve
                and drawdown always leave excluded trades out.
              </span>
            </span>
          </label>
        </Section>

        <Section
          title="Backups"
          description="Your journal already saves to disk automatically. These are for moving it, or keeping a copy elsewhere."
        >
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                exportBackup(data);
                // a phone opens its share sheet instead, which speaks for itself
                if (!native) toast('Backup downloaded');
              }}
            >
              <Download className="size-4" /> {native ? 'Back up your journal' : 'Download a backup'}
            </Button>
            <Button onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> Restore from a backup
            </Button>
            {CAN_BRING_OVER && (
              <Button onClick={() => void bringOver()}>
                <FolderInput className="size-4" /> Bring over from the earlier version
              </Button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                void restore(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {phone ? (
            <p className="mt-3 text-xs leading-relaxed text-faint">
              A dated copy is also kept inside the app automatically, once on each day you make changes, and the last 30
              are kept. Those copies are deleted along with the app, though, so save a backup to Drive, email or your
              files now and then. Chart images are not included in the backup.
            </p>
          ) : native ? (
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Your journal is in the Sniper Journal folder in your Documents, and stays there if you uninstall the app.
              A dated copy is also written into the backups folder next to it automatically, once on each day you make
              changes. The last 30 are kept. Chart images are saved as files in the screenshots folder rather than
              inside the backup, so copy that folder too if you are moving to another computer.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-faint">
              A dated copy is also written into the data/backups folder automatically, once on each day you make
              changes. The last 30 are kept. Chart images are saved as files in data/screenshots rather than inside the
              backup, so copy that folder too if you are moving to another computer.
            </p>
          )}
        </Section>

        <Section
          title="Chart images"
          description="Images no trade uses any more, such as one pasted into a trade form that was never saved."
        >
          <Button disabled={reclaiming} onClick={() => void reclaimCharts()}>
            <ImageMinus className="size-4" /> Reclaim unused chart images
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            You see how many there are, and how much space they take, before anything is deleted. An image is kept while
            your journal or any copy in your backups still uses it, and for a day after it was added, in case a trade
            form open in another window is about to save it.
          </p>
        </Section>

        <Section
          title="Test data"
          description="Generated trades for trying the app out. They are flagged separately and never mix into your own records."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                actions.loadSampleData();
                toast('Test data loaded');
              }}
            >
              <FlaskConical className="size-4" /> {sampleCount > 0 ? 'Regenerate test data' : 'Load test data'}
            </Button>
            <Button
              variant="danger"
              disabled={sampleCount === 0}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Remove test data?',
                  message: `This deletes the ${sampleCount} generated test trades, any chart images you attached to them, and the test playbook setups. Trades you entered yourself are kept.`,
                  confirmLabel: 'Remove test data',
                  tone: 'danger',
                });
                if (ok) {
                  actions.clearSampleData();
                  toast('Test data removed');
                }
              }}
            >
              <Trash2 className="size-4" /> Remove test data
            </Button>
            {sampleCount > 0 && <span className="text-xs text-warn">{sampleCount} test trades currently loaded</span>}
          </div>
        </Section>

        <Section title="Danger zone" description="There is no undo for this.">
          <Button
            variant="danger"
            onClick={async () => {
              const ok = await confirm({
                title: 'Erase everything?',
                message: `This permanently deletes ${
                  data.trades.length === 0
                    ? ''
                    : data.trades.length === 1
                      ? 'your 1 trade and its chart image, '
                      : `all ${data.trades.length} trades and their chart images, `
                }your setups, resources and accounts. Download a backup first if you are not certain; backups don't include chart images.`,
                confirmLabel: 'Erase my journal',
                tone: 'danger',
              });
              if (ok && (await keepCurrent('before-erase'))) {
                actions.resetAll();
                toast('Journal erased. A copy of it, without chart images, was kept in your backups.');
              }
            }}
          >
            <RotateCcw className="size-4" /> Erase all data
          </Button>
        </Section>
      </div>

      {editingMistakes && (
        <MistakeListEditor
          list={mistakes}
          onClose={() => setEditingMistakes(false)}
          onSave={(list, renamed) => {
            const moved = data.trades.filter((t) => t.mistakes?.some((m) => renamed.has(m))).length;
            actions.saveMistakes(list, renamed);
            setEditingMistakes(false);
            toast(
              moved ? `Mistakes saved, and renamed on ${moved} ${moved === 1 ? 'trade' : 'trades'}` : 'Mistakes saved',
            );
          }}
        />
      )}
    </>
  );
}

/** The mistake list, one per row, as the Playbook edits a setup's rules */
function MistakeListEditor({
  list,
  onSave,
  onClose,
}: {
  list: string[];
  /** `renamed`: each renamed mistake, old name → new, so the trades that have it follow */
  onSave: (list: string[], renamed: Map<string, string>) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<EditedRule[]>(() =>
    list.length ? list.map((text) => ({ text, was: text })) : [{ text: '', was: null }],
  );
  const setRow = (index: number, value: string) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, text: value } : r)));
  const addRow = () => setRows((rs) => [...rs, { text: '', was: null }]);

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop={false}
      size="md"
      title="Your mistakes"
      description="Renaming one renames it on every trade that has it. Taking one off the list leaves those trades as they are, and Reports still count it."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const { list: saved, renamed } = editedMistakes(rows);
          onSave(saved, renamed);
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`Mistake ${i + 1}`}
                value={row.text}
                onChange={(e) => setRow(i, e.target.value)}
                placeholder="e.g. Traded the first minute"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addRow();
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove mistake ${i + 1}`}
                onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={addRow}>
          <Plus className="size-3.5" /> Add a mistake
        </Button>

        <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save mistakes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
