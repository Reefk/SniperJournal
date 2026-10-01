'use client';

import { useRef, useState } from 'react';
import { Download, FlaskConical, Plus, RotateCcw, Trash2, Upload, Wallet } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { exportBackup, parseBackup } from '@/lib/backup';
import { CURRENCIES, formatMoney } from '@/lib/format';
import { toNumberOrNull } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const { data, actions, balances, sampleCount } = useJournal();
  const { confirm, toast } = useUI();
  const fileInput = useRef<HTMLInputElement>(null);
  const [newAccount, setNewAccount] = useState('');
  const currency = data.settings.currency;

  const restore = async (file: File | undefined) => {
    if (!file) return;
    const { data: parsed, error } = parseBackup(await file.text());
    if (!parsed) { toast(error ?? 'Could not read that file', 'error'); return; }
    const ok = await confirm({
      title: 'Restore this backup?',
      message: `The backup holds ${parsed.trades.length} trades. Restoring replaces everything currently in your journal.`,
      confirmLabel: 'Replace my journal',
      tone: 'danger',
    });
    if (ok) { actions.replaceAll(parsed); toast('Journal restored'); }
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
    if (ok) { actions.deleteAccount(id); toast('Account deleted'); }
  };

  return (
    <>
      <PageHeader title="Settings" description="Accounts, currency and your data." />

      <div className="grid max-w-5xl gap-4">
        <Section title="Profile and display">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Your name">
              <Input value={data.profile.name} onChange={(e) => actions.updateProfile({ name: e.target.value })} placeholder="Shown in the header" />
            </Field>
            <Field label="Currency" hint="used for every figure">
              <Select value={currency} onChange={(e) => actions.updateSettings({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Theme">
              <Select value={data.settings.theme} onChange={(e) => actions.updateSettings({ theme: e.target.value as 'dark' | 'light' })}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Risk limits" description="Used by the signals on the AI Insights page. Leave blank to turn a limit off.">
          <div className="grid grid-cols-2 gap-4">
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

        <Section title="Accounts" description="Each account keeps its own trades, balance and statistics.">
          <ul className="divide-y divide-line">
            {data.accounts.map((account) => (
              <li key={account.id} className="flex items-center gap-3 py-3 first:pt-0">
                <Wallet className="size-4 shrink-0 text-faint" />
                <Input
                  className="max-w-[220px]"
                  value={account.name}
                  onChange={(e) => actions.updateAccount(account.id, { name: e.target.value })}
                  aria-label="Account name"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Starting balance</span>
                  <Input
                    className="num w-32"
                    inputMode="decimal"
                    value={account.startingBalance}
                    onChange={(e) => actions.updateAccount(account.id, { startingBalance: toNumberOrNull(e.target.value) ?? 0 })}
                    aria-label="Starting balance"
                  />
                </div>
                <div className="ml-auto flex items-center gap-4">
                  <div className="text-right">
                    <div className="num text-sm font-medium text-fg">{formatMoney(balances[account.id] ?? 0, currency)}</div>
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
              <Input value={newAccount} onChange={(e) => setNewAccount(e.target.value)} placeholder="e.g. Prop firm challenge" />
            </Field>
            <Button type="submit"><Plus className="size-4" /> Add</Button>
          </form>
        </Section>

        <Section title="Backups" description="Your journal already saves to disk automatically. These are for moving it, or keeping a copy elsewhere.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { exportBackup(data); toast('Backup downloaded'); }}>
              <Download className="size-4" /> Download a backup
            </Button>
            <Button onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> Restore from a backup
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            A dated copy is also written into the data/backups folder automatically, once on each day you make changes. The last 30 are kept.
          </p>
        </Section>

        <Section title="Test data" description="Generated trades for trying the app out. They are flagged separately and never mix into your own records.">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { actions.loadSampleData(); toast('Test data loaded'); }}>
              <FlaskConical className="size-4" /> {sampleCount > 0 ? 'Regenerate test data' : 'Load test data'}
            </Button>
            <Button
              variant="danger"
              disabled={sampleCount === 0}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Remove test data?',
                  message: `This deletes the ${sampleCount} generated trades and the test setups. Your own trades are untouched.`,
                  confirmLabel: 'Remove test data',
                  tone: 'danger',
                });
                if (ok) { actions.clearSampleData(); toast('Test data removed'); }
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
                message: `This permanently deletes all ${data.trades.length} trades, your setups, resources and accounts. Download a backup first if you are not certain.`,
                confirmLabel: 'Erase my journal',
                tone: 'danger',
              });
              if (ok) { actions.resetAll(); toast('Journal erased'); }
            }}
          >
            <RotateCcw className="size-4" /> Erase all data
          </Button>
        </Section>
      </div>
    </>
  );
}
