'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Setup } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { groupTrades } from '@/lib/stats';
import { formatMoney, formatPct, formatRatio } from '@/lib/format';
import { uid } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { StatusBadge } from '@/components/ui/StatusBadge';

const COLORS = ['#6366f1', '#34d399', '#f59e0b', '#f43f5e', '#38bdf8', '#a78bfa'];

export function PlaybookView() {
  const { data, accountTrades, actions } = useJournal();
  const { confirm, toast } = useUI();
  const currency = data.settings.currency;
  const [editing, setEditing] = useState<Setup | null>(null);

  const performance = useMemo(() => {
    const groups = groupTrades(accountTrades, (t) => t.setupId);
    return new Map(groups.map((g) => [g.key, g]));
  }, [accountTrades]);

  const unassigned = accountTrades.filter((t) => !t.setupId).length;

  const remove = async (setup: Setup) => {
    const used = accountTrades.filter((t) => t.setupId === setup.id).length;
    const ok = await confirm({
      title: `Delete "${setup.name}"?`,
      message: used
        ? `${used} ${used === 1 ? 'trade is' : 'trades are'} tagged with this setup. The trades stay in your journal, they just lose the setup label.`
        : 'This setup will be removed from your playbook.',
      confirmLabel: 'Delete setup',
      tone: 'danger',
    });
    if (ok) { actions.deleteSetup(setup.id); toast('Setup deleted'); }
  };

  return (
    <>
      <PageHeader
        title="The Playbook"
        description="Write down the setups you are allowed to trade, then see which ones actually pay."
        actions={
          <Button variant="primary" onClick={() => setEditing({ id: uid(), name: '', description: '', rules: [''], color: COLORS[data.setups.length % COLORS.length] })}>
            <Plus className="size-4" /> New setup
          </Button>
        }
      />

      {data.setups.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Your playbook is empty"
          description="A setup is a pattern you have decided is worth your money, with the rules that make it valid. Once you tag trades with a setup, this page shows you which of your patterns earn and which only feel good."
          actions={
            <Button variant="primary" onClick={() => setEditing({ id: uid(), name: '', description: '', rules: [''], color: COLORS[0] })}>
              <Plus className="size-4" /> Write your first setup
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 2xl:grid-cols-3">
          {data.setups.map((setup) => {
            const perf = performance.get(setup.id);
            return (
              <article key={setup.id} className="flex flex-col rounded-xl border border-line bg-surface">
                <header className="flex items-start gap-3 border-b border-line px-5 py-4">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: setup.color ?? COLORS[0] }} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold text-fg">{setup.name}</h3>
                    {setup.description && <p className="mt-1 text-sm leading-relaxed text-muted">{setup.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(setup)} aria-label={`Edit ${setup.name}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="hover:bg-loss/10 hover:text-loss" onClick={() => remove(setup)} aria-label={`Delete ${setup.name}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </header>

                <div className="flex-1 px-5 py-4">
                  {setup.rules.filter(Boolean).length > 0 ? (
                    <ul className="space-y-2">
                      {setup.rules.filter(Boolean).map((rule, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-muted">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-profit" />
                          <span className="leading-relaxed">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-faint">No rules written yet. Rules are what make a setup checkable.</p>
                  )}
                </div>

                <footer className="border-t border-line px-5 py-3">
                  {perf ? (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        ['Trades', String(perf.trades), 'text-fg'],
                        ['Win rate', formatPct(perf.winRate, 0), 'text-fg'],
                        ['Net', formatMoney(perf.net, currency, { sign: true, compact: true }), perf.net > 0 ? 'text-profit' : perf.net < 0 ? 'text-loss' : 'text-fg'],
                        ['Factor', formatRatio(perf.profitFactor), perf.profitFactor != null && perf.profitFactor >= 1 ? 'text-profit' : 'text-loss'],
                      ].map(([label, value, tone]) => (
                        <div key={label}>
                          <div className="text-[11px] text-faint">{label}</div>
                          <div className={`num mt-0.5 text-sm font-semibold ${tone}`}>{value}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-xs text-faint">No trades tagged with this setup yet</p>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {unassigned > 0 && data.setups.length > 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <StatusBadge tone="warn">{unassigned}</StatusBadge>
          {unassigned === 1 ? 'trade has' : 'trades have'} no setup attached. Tagging them is what makes this page useful.
        </p>
      )}

      {editing && (
        <SetupEditor
          setup={editing}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            actions.upsertSetup({ ...next, rules: next.rules.map((r) => r.trim()).filter(Boolean) });
            setEditing(null);
            toast(`Setup "${next.name}" saved`);
          }}
        />
      )}
    </>
  );
}

function SetupEditor({ setup, onSave, onClose }: { setup: Setup; onSave: (setup: Setup) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Setup>({ ...setup, rules: setup.rules.length ? setup.rules : [''] });
  const [error, setError] = useState('');

  const setRule = (index: number, value: string) =>
    setDraft((d) => ({ ...d, rules: d.rules.map((r, i) => (i === index ? value : r)) }));

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop={false}
      size="lg"
      title={setup.name ? `Edit ${setup.name}` : 'New setup'}
      description="A setup you can check against before you click buy."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.name.trim()) { setError('Give the setup a name'); return; }
          onSave({ ...draft, name: draft.name.trim() });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-[1fr_auto] gap-4">
          <Field label="Setup name" error={error}>
            <Input autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Opening Range Breakout" />
          </Field>
          <Field label="Colour">
            <div className="flex h-9 items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use colour ${c}`}
                  onClick={() => setDraft((d) => ({ ...d, color: c }))}
                  className="size-6 rounded-full transition"
                  style={{ background: c, outline: draft.color === c ? '2px solid var(--fg)' : 'none', outlineOffset: 2 }}
                />
              ))}
            </div>
          </Field>
        </div>

        <Field label="What it is" hint="optional">
          <Textarea
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Describe the pattern in a sentence or two, the way you would explain it to someone else."
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-medium text-muted">Rules</span>
            <span className="text-faint">every one must be true before you take the trade</span>
          </div>
          <div className="space-y-2">
            {draft.rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="num w-5 shrink-0 text-center text-xs text-faint">{i + 1}</span>
                <Input
                  value={rule}
                  onChange={(e) => setRule(i, e.target.value)}
                  placeholder="e.g. Volume above the 20 period average"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); setDraft((d) => ({ ...d, rules: [...d.rules, ''] })); }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove rule ${i + 1}`}
                  onClick={() => setDraft((d) => ({ ...d, rules: d.rules.filter((_, idx) => idx !== i) }))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setDraft((d) => ({ ...d, rules: [...d.rules, ''] }))}>
            <Plus className="size-3.5" /> Add a rule
          </Button>
        </div>

        <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">Save setup</Button>
        </div>
      </form>
    </Modal>
  );
}
