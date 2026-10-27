'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Setup } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { groupTrades } from '@/lib/stats';
import {
  editedRules,
  MIN_RULE_SIDE,
  setupRuleReport,
  type EditedRule,
  type RuleLine,
  type RuleReport,
} from '@/lib/rules';
import { formatMoney, formatPct, formatRatio } from '@/lib/format';
import { cn, uid } from '@/lib/utils';
import { storage } from '@/lib/storage';
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

  const ruleReports = useMemo(
    () => new Map(data.setups.map((s) => [s.id, setupRuleReport(accountTrades, s)])),
    [accountTrades, data.setups],
  );

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
    if (ok) {
      actions.deleteSetup(setup.id);
      toast('Setup deleted');
    }
  };

  return (
    <>
      <PageHeader
        title="The Playbook"
        description="Write down the setups you are allowed to trade, then see which ones actually pay."
        actions={
          <Button
            variant="primary"
            onClick={() =>
              setEditing({
                id: uid(),
                name: '',
                description: '',
                rules: [''],
                color: COLORS[data.setups.length % COLORS.length],
              })
            }
          >
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
            <Button
              variant="primary"
              onClick={() => setEditing({ id: uid(), name: '', description: '', rules: [''], color: COLORS[0] })}
            >
              <Plus className="size-4" /> Write your first setup
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.setups.map((setup) => {
            const perf = performance.get(setup.id);
            const rules = ruleReports.get(setup.id);
            const lineOf = new Map(rules?.rules.map((line) => [line.rule, line]));
            const removed = rules?.rules.filter((line) => !line.current) ?? [];
            return (
              <article key={setup.id} className="flex flex-col rounded-xl border border-line bg-surface">
                <header className="flex items-start gap-3 border-b border-line px-5 py-4">
                  <span
                    className="mt-1.5 size-2.5 shrink-0 rounded-full"
                    style={{ background: setup.color ?? COLORS[0] }}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 dir="auto" className="truncate text-[15px] font-semibold text-fg">
                      {setup.name}
                    </h3>
                    {setup.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted">{setup.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(setup)}
                      aria-label={`Edit ${setup.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="hover:bg-loss/10 hover:text-loss"
                      onClick={() => remove(setup)}
                      aria-label={`Delete ${setup.name}`}
                    >
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
                          <div className="min-w-0">
                            <span className="leading-relaxed">{rule}</span>
                            <RuleTally line={lineOf.get(rule)} costliest={rules?.costliest} currency={currency} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-faint">No rules written yet. Rules are what make a setup checkable.</p>
                  )}
                  {removed.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] text-faint">No longer in this setup</div>
                      <ul className="mt-1 space-y-2">
                        {removed.map((line) => (
                          <li key={line.rule} className="text-sm text-faint">
                            <span className="leading-relaxed">{line.rule}</span>
                            <RuleTally line={line} costliest={rules?.costliest} currency={currency} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {rules && rules.checked > 0 && <RulesKept report={rules} currency={currency} />}

                <footer className="border-t border-line px-5 py-3">
                  {perf ? (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        ['Trades', String(perf.trades), 'text-fg'],
                        ['Win rate', formatPct(perf.winRate, 0), 'text-fg'],
                        [
                          'Net',
                          formatMoney(perf.net, currency, { sign: true, compact: true }),
                          perf.net > 0 ? 'text-profit' : perf.net < 0 ? 'text-loss' : 'text-fg',
                        ],
                        [
                          'Factor',
                          formatRatio(perf.profitFactor),
                          perf.profitFactor != null && perf.profitFactor >= 1 ? 'text-profit' : 'text-loss',
                        ],
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
          {unassigned === 1 ? 'trade has' : 'trades have'} no setup attached. Tagging them is what makes this page
          useful.
        </p>
      )}

      {editing && (
        <SetupEditor
          setup={editing}
          onClose={() => setEditing(null)}
          onSave={(next, renamedRules) => {
            actions.upsertSetup(next, renamedRules);
            setEditing(null);
            toast(`Setup "${next.name}" saved`);
          }}
        />
      )}
    </>
  );
}

/** signed money; compact only from a thousand up, where it reads +$3.34K (below, compact gives +$541.1) */
const short = (value: number, currency: string) =>
  formatMoney(value, currency, { sign: true, compact: Math.abs(value) >= 1000 });

/** How a setup's trades did against one of its rules */
function RuleTally({
  line,
  costliest,
  currency,
}: {
  line: RuleLine | undefined;
  costliest: RuleLine | null | undefined;
  currency: string;
}) {
  if (!line || line.kept + line.broken === 0) return null;
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
      <span className="num">
        kept {line.kept} of {line.kept + line.broken}
      </span>
      {line.broken > 0 && (
        <span className={cn('num', line.brokenNet < 0 && 'text-loss')}>
          broken {line.broken}× · {short(line.brokenNet, currency)}
        </span>
      )}
      {line === costliest && <StatusBadge tone="loss">costliest to break</StatusBadge>}
    </div>
  );
}

/** The trades that kept every rule of the setup against the ones that broke one */
function RulesKept({ report, currency }: { report: RuleReport; currency: string }) {
  const { kept, broken, checked, partial, cost } = report;
  const unchecked = report.trades - checked;
  const many = (n: number) => (n === 1 ? 'trade' : 'trades');
  const net = (v: number) => (v > 0 ? 'text-profit' : v < 0 ? 'text-loss' : 'text-fg');

  return (
    <section aria-label="Rules kept" className="border-t border-line px-5 py-3 text-xs">
      <p className="text-muted">
        Every rule kept on <span className="num font-semibold text-fg">{kept?.trades ?? 0}</span> of {checked} checked{' '}
        {many(checked)}
        {partial > 0 && <> · {partial} partly checked</>}
        {unchecked > 0 && <> · {unchecked} not checked</>}
      </p>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-[11px] text-faint">
            <th className="text-start font-normal">
              <span className="sr-only">Rules</span>
            </th>
            <th className="ps-2 text-end font-normal">Trades</th>
            <th className="ps-2 text-end font-normal">Net</th>
            <th className="ps-2 text-end font-normal">Win rate</th>
            <th className="ps-2 text-end font-normal">Avg R</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['Every rule kept', kept],
              ['A rule broken', broken],
            ] as const
          ).map(([label, side]) => (
            <tr key={label}>
              <th scope="row" className="py-0.5 text-start font-normal text-muted">
                {label}
              </th>
              <td className="num ps-2 text-end text-fg">{side?.trades ?? 0}</td>
              <td className={cn('num ps-2 text-end', side ? net(side.net) : 'text-faint')}>
                {side ? short(side.net, currency) : '—'}
              </td>
              <td className="num ps-2 text-end text-fg">{side ? formatPct(side.winRate, 0) : '—'}</td>
              <td className="num ps-2 text-end text-fg">
                {side?.avgR != null ? `${side.avgR >= 0 ? '+' : ''}${side.avgR.toFixed(2)}R` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cost != null && broken && (
        <p className="mt-2 leading-relaxed text-muted">
          {cost > 0 ? (
            <>
              Breaking a rule cost about{' '}
              <span className="num font-semibold text-loss">{formatMoney(cost, currency)}</span> here: the{' '}
              {broken.trades} {many(broken.trades)} that broke one would have made that much more at the average of the
              trades that kept every rule.
            </>
          ) : (
            'Breaking a rule has not cost money on this setup so far.'
          )}
        </p>
      )}
      {cost == null && kept && broken && (
        <p className="mt-2 leading-relaxed text-faint">
          What breaking a rule costs shows once {MIN_RULE_SIDE} trades are on each side.
        </p>
      )}
    </section>
  );
}

function SetupEditor({
  setup,
  onSave,
  onClose,
}: {
  setup: Setup;
  /** `renamedRules`: each reworded rule, old wording → new, so its trades' ticks follow it */
  onSave: (setup: Setup, renamedRules: Map<string, string>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Setup>(setup);
  const [rows, setRows] = useState<EditedRule[]>(() =>
    setup.rules.length ? setup.rules.map((text) => ({ text, was: text })) : [{ text: '', was: null }],
  );
  const [error, setError] = useState('');

  const setRule = (index: number, value: string) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, text: value } : r)));
  const addRule = () => setRows((rs) => [...rs, { text: '', was: null }]);

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
          if (!draft.name.trim()) {
            setError('Give the setup a name');
            return;
          }
          const { rules, renamed } = editedRules(rows);
          onSave({ ...draft, name: draft.name.trim(), rules }, renamed);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <Field label="Setup name" error={error}>
            <Input
              autoFocus={storage.device === 'pc'}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Opening Range Breakout"
            />
          </Field>
          <Field label="Colour">
            <div className="flex h-10 items-center gap-2.5 md:h-9 md:gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use colour ${c}`}
                  onClick={() => setDraft((d) => ({ ...d, color: c }))}
                  className="size-8 rounded-full transition md:size-6"
                  style={{
                    background: c,
                    outline: draft.color === c ? '2px solid var(--fg)' : 'none',
                    outlineOffset: 2,
                  }}
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
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="num w-5 shrink-0 text-center text-xs text-faint">{i + 1}</span>
                <Input
                  value={row.text}
                  onChange={(e) => setRule(i, e.target.value)}
                  placeholder="e.g. Volume above the 20 period average"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRule();
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove rule ${i + 1}`}
                  onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={addRule}>
            <Plus className="size-3.5" /> Add a rule
          </Button>
        </div>

        <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save setup
          </Button>
        </div>
      </form>
    </Modal>
  );
}
