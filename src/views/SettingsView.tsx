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
import { editedMistakes, mistakeList, mistakeName } from '@/lib/mistakes';
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
import { GoalFields } from '@/components/settings/GoalFields';
import { LanguageSelect } from '@/components/settings/LanguageSelect';
import { tr } from '@/lib/i18n';

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
      toast(error ?? tr('settings.unreadable'), 'error');
      return;
    }
    const ok = await confirm({
      title: tr('settings.restore.title'),
      message: tr('settings.restore.message', { count: parsed.trades.length }),
      confirmLabel: tr('settings.restore.confirm'),
      tone: 'danger',
    });
    if (ok) {
      // the journal being replaced must stay recoverable, so no copy, no restore
      if (!(await keepCurrent('before-restore'))) return;
      actions.replaceAll(parsed);
      toast(tr('settings.restored'));
    }
  };

  /** a dated copy of the journal as it is now; false (and a message) when that fails */
  const keepCurrent = async (reason: CopyReason): Promise<boolean> => {
    try {
      await storage.keepCopy(data, reason);
      return true;
    } catch {
      toast(tr('settings.noCopy'), 'error');
      return false;
    }
  };

  const reclaimCharts = async () => {
    setReclaiming(true);
    try {
      const unused = await findUnusedCharts(data.trades);
      if (!unused.length) {
        toast(tr('settings.reclaim.none'));
        return;
      }
      const count = unused.length;
      const ok = await confirm({
        title: tr('settings.reclaim.title', { count }),
        message: tr('settings.reclaim.message', { count, size: formatBytes(unused.reduce((a, i) => a + i.bytes, 0)) }),
        confirmLabel: tr('settings.reclaim.confirm', { count }),
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
          ? tr('settings.reclaim.done', {
              count: removed.length,
              size: formatBytes(removed.reduce((a, i) => a + i.bytes, 0)),
            })
          : tr('settings.reclaim.nothing'),
      );
    } catch (err) {
      // a plain Error carries the storage's own explanation (a damaged journal,
      // a backup it could not read); anything else (a failed fetch, an
      // unreadable reply) means the data folder was out of reach
      toast(
        err instanceof Error && err.name === 'Error' && err.message ? err.message : tr('settings.reclaim.unreachable'),
        'error',
      );
    } finally {
      setReclaiming(false);
    }
  };

  const deleteAccount = async (id: string, name: string) => {
    const count = data.trades.filter((t) => t.accountId === id).length;
    const ok = await confirm({
      title: tr('settings.deleteAccount.title', { name }),
      message: count ? tr('settings.deleteAccount.message', { count }) : tr('settings.deleteAccount.empty'),
      confirmLabel: tr('settings.deleteAccount.confirm'),
      tone: 'danger',
    });
    if (ok) {
      actions.deleteAccount(id);
      toast(tr('settings.accountDeleted'));
    }
  };

  return (
    <>
      <PageHeader title={tr('settings.title')} description={tr('settings.description')} />

      <div className="grid max-w-5xl gap-4">
        <Section title={tr('settings.profile')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={tr('common.yourName')}>
              <Input
                value={data.profile.name}
                onChange={(e) => actions.updateProfile({ name: e.target.value })}
                placeholder={tr('common.namePlaceholder')}
              />
            </Field>
            <Field label={tr('common.language')}>
              <LanguageSelect />
            </Field>
            <Field label={tr('common.currency')} hint={tr('settings.currencyHint')}>
              <Select value={currency} onChange={(e) => actions.updateSettings({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr('settings.theme')}>
              <Select
                value={data.settings.theme}
                onChange={(e) => actions.updateSettings({ theme: e.target.value as 'dark' | 'light' })}
              >
                <option value="dark">{tr('settings.theme.dark')}</option>
                <option value="light">{tr('settings.theme.light')}</option>
              </Select>
            </Field>
            <Field label={tr('settings.placeholders')}>
              <Select
                value={data.settings.fadedPlaceholders === true ? 'faded' : 'clear'}
                onChange={(e) => actions.updateSettings({ fadedPlaceholders: e.target.value === 'faded' })}
              >
                <option value="clear">{tr('settings.placeholders.clear')}</option>
                <option value="faded">{tr('settings.placeholders.faded')}</option>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title={tr('settings.limits')} description={tr('settings.limitsHint')}>
          <h3 className="text-xs font-semibold text-fg">{tr('settings.dailyLimits')}</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={tr('settings.maxLoss')} hint={currency}>
              <Input
                inputMode="decimal"
                className="num"
                value={data.settings.maxDailyLoss ?? ''}
                onChange={(e) => actions.updateSettings({ maxDailyLoss: toNumberOrNull(e.target.value) })}
                placeholder={tr('goals.example', { n: '500' })}
              />
            </Field>
            <Field label={tr('settings.maxTrades')}>
              <Input
                inputMode="numeric"
                className="num"
                value={data.settings.maxTradesPerDay ?? ''}
                onChange={(e) => actions.updateSettings({ maxTradesPerDay: toNumberOrNull(e.target.value) })}
                placeholder={tr('goals.example', { n: '3' })}
              />
            </Field>
          </div>
          <GoalFields />
        </Section>

        <Section title={tr('settings.mistakes')} description={tr('settings.mistakesHint')}>
          {mistakes.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={tr('settings.yourMistakes')}>
              {mistakes.map((mistake) => (
                <li key={mistake} className="rounded-md border border-line bg-app px-2.5 py-1 text-xs text-muted">
                  {mistakeName(mistake)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{tr('settings.mistakesEmpty')}</p>
          )}
          <Button className="mt-3" onClick={() => setEditingMistakes(true)}>
            <Pencil className="size-4" /> {tr('settings.editList')}
          </Button>
        </Section>

        <Section title={tr('settings.tags')} description={tr('settings.tagsHint')}>
          <TagManager />
        </Section>

        <Section title={tr('settings.accounts')} description={tr('settings.accountsHint')}>
          <ul className="divide-y divide-line">
            {data.accounts.map((account) => (
              // phone: name and balance on the first line, the starting balance below
              <li key={account.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 md:flex-nowrap">
                <Wallet className="size-4 shrink-0 text-faint" />
                <Input
                  className="min-w-0 flex-1 md:max-w-[220px]"
                  value={account.name}
                  onChange={(e) => actions.updateAccount(account.id, { name: e.target.value })}
                  aria-label={tr('common.accountName')}
                />
                <div className="flex items-center gap-2 max-md:order-last max-md:w-full max-md:ps-7">
                  <span className="text-xs text-muted max-md:whitespace-nowrap">{tr('common.startingBalance')}</span>
                  <Input
                    className="num w-32"
                    inputMode="decimal"
                    value={account.startingBalance}
                    onChange={(e) =>
                      actions.updateAccount(account.id, { startingBalance: toNumberOrNull(e.target.value) ?? 0 })
                    }
                    aria-label={tr('common.startingBalance')}
                  />
                </div>
                <div className="ms-auto flex items-center gap-4">
                  <div className="text-end">
                    <div className="num text-sm font-medium text-fg">
                      {formatMoney(balances[account.id] ?? 0, currency)}
                    </div>
                    <div className="text-[11px] text-faint">
                      {tr('settings.accountTrades', {
                        count: data.trades.filter((t) => t.accountId === account.id).length,
                      })}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:bg-loss/10 hover:text-loss"
                    disabled={data.accounts.length === 1}
                    title={
                      data.accounts.length === 1 ? tr('settings.oneAccountNeeded') : tr('settings.deleteThisAccount')
                    }
                    onClick={() => deleteAccount(account.id, account.name)}
                    aria-label={tr('settings.deleteNamed', { name: account.name })}
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
              toast(tr('common.accountCreated', { name: newAccount.trim() }));
              setNewAccount('');
            }}
          >
            <Field label={tr('settings.addAccount')} className="max-w-xs flex-1">
              <Input
                value={newAccount}
                onChange={(e) => setNewAccount(e.target.value)}
                placeholder={tr('common.accountPlaceholder')}
              />
            </Field>
            <Button type="submit">
              <Plus className="size-4" /> {tr('common.add')}
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
              <span className="text-fg">{tr('settings.countExcluded')}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                {tr('settings.countExcludedHint')}
              </span>
            </span>
          </label>
        </Section>

        <Section title={tr('settings.backups')} description={tr('settings.backupsHint')}>
          <div className="flex flex-wrap gap-2">
            <Button
              wrap
              onClick={() => {
                exportBackup(data);
                // a phone opens its share sheet instead, which speaks for itself
                if (!native) toast(tr('common.backupDownloaded'));
              }}
            >
              <Download className="size-4 shrink-0" />{' '}
              {native ? tr('common.backUpJournal') : tr('common.downloadBackup')}
            </Button>
            <Button wrap onClick={() => fileInput.current?.click()}>
              <Upload className="size-4 shrink-0" /> {tr('settings.restore')}
            </Button>
            {CAN_BRING_OVER && (
              <Button wrap onClick={() => void bringOver()}>
                <FolderInput className="size-4 shrink-0 rtl:-scale-x-100" /> {tr('settings.bringOver')}
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
            <p className="mt-3 text-xs leading-relaxed text-faint">{tr('settings.backups.phone')}</p>
          ) : native ? (
            <p className="mt-3 text-xs leading-relaxed text-faint">{tr('settings.backups.app')}</p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-faint">{tr('settings.backups.server')}</p>
          )}
        </Section>

        <Section title={tr('settings.charts')} description={tr('settings.chartsHint')}>
          <Button wrap disabled={reclaiming} onClick={() => void reclaimCharts()}>
            <ImageMinus className="size-4 shrink-0" /> {tr('settings.reclaim')}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-faint">{tr('settings.reclaimHint')}</p>
        </Section>

        <Section title={tr('settings.testData')} description={tr('settings.testDataHint')}>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              wrap
              onClick={() => {
                actions.loadSampleData();
                toast(tr('settings.testDataLoaded'));
              }}
            >
              <FlaskConical className="size-4 shrink-0" />{' '}
              {sampleCount > 0 ? tr('settings.regenerateTestData') : tr('settings.loadTestData')}
            </Button>
            <Button
              variant="danger"
              disabled={sampleCount === 0}
              onClick={async () => {
                const ok = await confirm({
                  title: tr('common.removeTestData.title'),
                  message: tr('common.removeTestData.message', { count: sampleCount }),
                  confirmLabel: tr('common.removeTestData.confirm'),
                  tone: 'danger',
                });
                if (ok) {
                  actions.clearSampleData();
                  toast(tr('common.testDataRemoved'));
                }
              }}
            >
              <Trash2 className="size-4" /> {tr('common.removeTestData.confirm')}
            </Button>
            {sampleCount > 0 && (
              <span className="text-xs text-warn">{tr('settings.testTradesLoaded', { count: sampleCount })}</span>
            )}
          </div>
        </Section>

        <Section title={tr('settings.danger')} description={tr('settings.dangerHint')}>
          <Button
            variant="danger"
            onClick={async () => {
              const ok = await confirm({
                title: tr('settings.erase.title'),
                message: data.trades.length
                  ? tr('settings.erase.message', { count: data.trades.length })
                  : tr('settings.erase.empty'),
                confirmLabel: tr('settings.erase.confirm'),
                tone: 'danger',
              });
              if (ok && (await keepCurrent('before-erase'))) {
                actions.resetAll();
                toast(tr('settings.erased'));
              }
            }}
          >
            <RotateCcw className="size-4" /> {tr('settings.erase')}
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
            toast(moved ? tr('settings.mistakesRenamed', { count: moved }) : tr('settings.mistakesSaved'));
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
    list.length ? list.map((text) => ({ text: mistakeName(text), was: text })) : [{ text: '', was: null }],
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
      title={tr('settings.yourMistakes')}
      description={tr('settings.mistakesEditorHint')}
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
                aria-label={tr('settings.mistakeN', { n: i + 1 })}
                value={row.text}
                onChange={(e) => setRow(i, e.target.value)}
                placeholder={tr('settings.mistakePlaceholder')}
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
                aria-label={tr('settings.removeMistakeN', { n: i + 1 })}
                onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={addRow}>
          <Plus className="size-3.5" /> {tr('settings.addMistake')}
        </Button>

        <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button variant="primary" type="submit">
            {tr('settings.saveMistakes')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
