'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Trash2, TriangleAlert } from 'lucide-react';
import type { RuleChecks, Side, Trade, TradeInput } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { detectSession, SESSIONS, sessionName } from '@/lib/sessions';
import { checksToSave, rulesShown } from '@/lib/rules';
import { mistakeList, mistakesShown } from '@/lib/mistakes';
import { arrangeByGroup } from '@/lib/tags';
import { formatDuration, formatMoney, formatNumber, formatR, formatRatio } from '@/lib/format';
import { isolate, language, tr } from '@/lib/i18n';
import { grossPnl, holdMinutes, isClosed, netPnl, plannedRR, riskAmount, rMultiple } from '@/lib/trade-math';
import { cn, toLocalInput, toNumberOrNull } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { chartsToDiscard, deleteScreenshot } from '@/lib/screenshots';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { TagInput } from '@/components/ui/TagInput';
import { RatingInput } from '@/components/ui/RatingInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ChartImage } from './ChartImage';
import { ImportBody } from './ImportTradesModal';
import { RuleChecklist } from './RuleChecklist';
import { MistakeChips } from './MistakeChips';

interface FormState {
  accountId: string;
  symbol: string;
  side: Side;
  openedAt: string;
  closedAt: string;
  quantity: string;
  entryPrice: string;
  exitPrice: string;
  stopLoss: string;
  takeProfit: string;
  fees: string;
  multiplier: string;
  pnlMode: 'auto' | 'manual';
  manualPnl: string;
  leverage: string;
  session: string;
  sessionTouched: boolean;
  setupId: string;
  ruleChecks?: RuleChecks;
  /** the checklist was used, or the setup changed: the ticks are saved as the checklist shows them */
  rulesTouched: boolean;
  mistakes: string[];
  tags: string[];
  notes: string;
  screenshotUrl: string;
  screenshotFile?: string;
  discipline?: number;
  execution?: number;
  patience?: number;
}

type Errors = Partial<Record<keyof FormState, string>>;
const str = (v: number | null | undefined) => (v == null ? '' : String(v));
/** a zero quantity or price is what an incomplete import leaves behind, so show
 *  the field as empty and let the person type the real number */
const gapStr = (v: number | null | undefined) => (v == null || v === 0 ? '' : String(v));

function initialState(accountId: string, trade?: Trade, defaults?: Partial<Trade>): FormState {
  const src: Partial<Trade> = trade ?? defaults ?? {};
  const openedAt = src.openedAt ?? toLocalInput(new Date());
  return {
    accountId: src.accountId ?? accountId,
    symbol: src.symbol ?? '',
    side: src.side ?? 'LONG',
    openedAt,
    closedAt: src.closedAt ?? '',
    quantity: gapStr(src.quantity),
    entryPrice: gapStr(src.entryPrice),
    exitPrice: str(src.exitPrice),
    stopLoss: str(src.stopLoss),
    takeProfit: str(src.takeProfit),
    fees: str(src.fees),
    multiplier: str(src.multiplier ?? 1),
    pnlMode: src.manualPnl != null ? 'manual' : 'auto',
    manualPnl: str(src.manualPnl),
    leverage: str(src.leverage),
    session: src.session ?? detectSession(openedAt),
    sessionTouched: Boolean(trade?.session),
    setupId: src.setupId ?? '',
    // ticks belong to the trade they were made on, never to defaults for a new one
    ruleChecks: trade?.ruleChecks,
    rulesTouched: false,
    // like the ticks: what this trade did wrong, never a default for a new one
    mistakes: trade?.mistakes ?? [],
    tags: src.tags ?? [],
    notes: src.notes ?? '',
    screenshotUrl: src.screenshotUrl ?? '',
    screenshotFile: src.screenshotFile,
    discipline: src.review?.discipline,
    execution: src.review?.execution,
    patience: src.review?.patience,
  };
}

/** `setupRules`: the rules of the setup chosen in the form */
function validate(f: FormState, setupRules: string[], editing?: Trade): { errors: Errors; input?: TradeInput } {
  const errors: Errors = {};
  const symbol = f.symbol.trim().toUpperCase();
  const quantity = toNumberOrNull(f.quantity);
  const entryPrice = toNumberOrNull(f.entryPrice);
  const exitPrice = toNumberOrNull(f.exitPrice);
  const multiplier = toNumberOrNull(f.multiplier) ?? 1;
  const manualPnl = f.pnlMode === 'manual' ? toNumberOrNull(f.manualPnl) : null;

  if (!symbol) errors.symbol = tr('form.error.symbol');
  if (!f.openedAt) errors.openedAt = tr('form.error.entryTime');
  if (quantity == null || quantity <= 0) errors.quantity = tr('form.error.aboveZero');
  if (entryPrice == null) errors.entryPrice = tr('form.error.entryPrice');
  if (f.exitPrice.trim() && exitPrice == null) errors.exitPrice = tr('form.error.number');
  if (f.stopLoss.trim() && toNumberOrNull(f.stopLoss) == null) errors.stopLoss = tr('form.error.number');
  if (f.takeProfit.trim() && toNumberOrNull(f.takeProfit) == null) errors.takeProfit = tr('form.error.number');
  if (f.fees.trim() && toNumberOrNull(f.fees) == null) errors.fees = tr('form.error.number');
  if (multiplier <= 0) errors.multiplier = tr('form.error.aboveZero');
  if (f.pnlMode === 'manual' && manualPnl == null) errors.manualPnl = tr('form.error.grossPnl');
  if (f.closedAt && f.openedAt && f.closedAt < f.openedAt) errors.closedAt = tr('form.error.exitBeforeEntry');

  if (Object.keys(errors).length) return { errors };

  return {
    errors,
    input: {
      accountId: f.accountId,
      symbol,
      side: f.side,
      openedAt: f.openedAt,
      closedAt: f.closedAt || undefined,
      quantity: quantity as number,
      entryPrice: entryPrice as number,
      exitPrice,
      stopLoss: toNumberOrNull(f.stopLoss),
      takeProfit: toNumberOrNull(f.takeProfit),
      fees: toNumberOrNull(f.fees) ?? 0,
      multiplier,
      manualPnl,
      leverage: toNumberOrNull(f.leverage),
      session: f.session || undefined,
      setupId: f.setupId || undefined,
      // untouched, a trade keeps the ticks it was saved with, so editing its notes doesn't re-judge it
      ruleChecks: !f.setupId ? undefined : f.rulesTouched ? checksToSave(setupRules, f.ruleChecks) : f.ruleChecks,
      mistakes: f.mistakes.length ? f.mistakes : undefined,
      tags: f.tags,
      notes: f.notes.trim() || undefined,
      screenshotUrl: f.screenshotUrl.trim() || undefined,
      screenshotFile: f.screenshotFile,
      review: { discipline: f.discipline, execution: f.execution, patience: f.patience },
      excluded: editing?.excluded ?? false,
      isSample: editing?.isSample,
      externalId: editing?.externalId,
    },
  };
}

/** lenient copy of the form so the preview updates while you type */
function previewTrade(f: FormState): Trade {
  return {
    id: 'preview',
    accountId: f.accountId,
    symbol: f.symbol,
    side: f.side,
    openedAt: f.openedAt,
    closedAt: f.closedAt || undefined,
    quantity: toNumberOrNull(f.quantity) ?? 0,
    entryPrice: toNumberOrNull(f.entryPrice) ?? 0,
    exitPrice: f.pnlMode === 'manual' ? null : toNumberOrNull(f.exitPrice),
    stopLoss: toNumberOrNull(f.stopLoss),
    takeProfit: toNumberOrNull(f.takeProfit),
    fees: toNumberOrNull(f.fees) ?? 0,
    multiplier: toNumberOrNull(f.multiplier) || 1,
    manualPnl: f.pnlMode === 'manual' ? toNumberOrNull(f.manualPnl) : null,
    tags: [],
    createdAt: '',
    updatedAt: '',
  };
}

/**
 * A new trade is logged by hand or from a broker's file. The way last used is
 * remembered on this device, so someone who always imports gets the file first.
 */
type LogWay = 'hand' | 'csv';
const LOG_WAY_KEY = 'sniper-journal:log-trade-way';
function rememberedWay(): LogWay {
  try {
    return localStorage.getItem(LOG_WAY_KEY) === 'csv' ? 'csv' : 'hand';
  } catch {
    return 'hand';
  }
}
function rememberWay(way: LogWay) {
  try {
    if (way === 'csv') localStorage.setItem(LOG_WAY_KEY, way);
    else localStorage.removeItem(LOG_WAY_KEY);
  } catch {
    /* storage unavailable: the form simply opens by hand */
  }
}
const logWays = () =>
  [
    { value: 'hand', label: tr('form.byHand') },
    { value: 'csv', label: tr('form.fromFile') },
  ] as const;

// Three fields side by side, their labels, boxes and messages each in a row
// they share, so the boxes line up when a label or hint takes two lines (a
// phone, a longer language). Without subgrid, as before: each field stacked.
const ROW3 = 'grid grid-cols-3 grid-rows-[auto_auto_auto] gap-x-3';
const IN_ROW3 = 'row-span-3 grid grid-rows-subgrid';

export function TradeFormModal() {
  const { tradeForm, closeTradeForm } = useUI();
  const editing = tradeForm.trade;
  // null until chosen here: the way remembered on this device (read only
  // once the form is open, as the dialog renders nothing before)
  const [chosen, setChosen] = useState<LogWay | null>(null);
  const fromCsv = !editing && (chosen ?? rememberedWay()) === 'csv';
  return (
    <Modal
      open={tradeForm.open}
      onClose={closeTradeForm}
      closeOnBackdrop={false}
      size="xl"
      phone="full"
      title={editing ? tr('form.editTitle', { symbol: editing.symbol }) : tr('header.logTradeLabel')}
      description={editing ? tr('form.editHint') : fromCsv ? tr('form.fileHint') : tr('form.handHint')}
    >
      {!editing && (
        <SegmentedControl
          options={logWays()}
          value={fromCsv ? 'csv' : 'hand'}
          onChange={(way) => {
            setChosen(way);
            rememberWay(way);
          }}
          className="mb-4"
        />
      )}
      {/* kept while the file is chosen, so switching back finds the form as it was */}
      <div hidden={fromCsv}>
        <TradeForm key={tradeForm.nonce} trade={editing} defaults={tradeForm.defaults} onDone={closeTradeForm} />
      </div>
      {fromCsv && <ImportBody key={tradeForm.nonce} onClose={closeTradeForm} />}
    </Modal>
  );
}

function TradeForm({ trade, defaults, onDone }: { trade?: Trade; defaults?: Partial<Trade>; onDone: () => void }) {
  const { data, actions } = useJournal();
  const { toast, confirm } = useUI();
  const currency = data.settings.currency;
  const fallbackAccount = data.activeAccountId === 'all' ? data.accounts[0].id : data.activeAccountId;
  const [form, setForm] = useState<FormState>(() => initialState(fallbackAccount, trade, defaults));
  const [errors, setErrors] = useState<Errors>({});
  // chart images added while the form is open. None is deleted until the
  // form closes: saving keeps the one shown, Cancel the one the trade had.
  const uploaded = useRef(new Set<string>());
  const usedElsewhere = (name: string) => data.trades.some((t) => t.id !== trade?.id && t.screenshotFile === name);
  const discardCharts = (kept: string | undefined) => {
    for (const name of chartsToDiscard(uploaded.current, trade?.screenshotFile, kept, usedElsewhere)) {
      void deleteScreenshot(name);
    }
    uploaded.current.clear();
  };
  // closed without saving (Cancel, Escape, the close button): only what was
  // uploaded since it opened goes; the trade keeps its chart
  useEffect(() => {
    const added = uploaded.current;
    const original = trade?.screenshotFile;
    return () => {
      for (const name of chartsToDiscard(added, original, original, () => true)) void deleteScreenshot(name);
    };
  }, [trade]);

  const [showAdvanced, setShowAdvanced] = useState(() =>
    Boolean(trade && (trade.manualPnl != null || (trade.multiplier && trade.multiplier !== 1) || trade.screenshotUrl)),
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'openedAt' && !f.sessionTouched) next.session = detectSession(String(value));
      if (key === 'setupId') {
        // another setup has other rules; going back to the trade's own brings its ticks back
        const own = value === (trade?.setupId ?? '');
        next.ruleChecks = own ? trade?.ruleChecks : undefined;
        next.rulesTouched = !own;
      }
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const symbols = useMemo(() => [...new Set(data.trades.map((t) => t.symbol))].sort(), [data.trades]);
  const tagSuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of data.trades) for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [data.trades]);

  const chosenSetup = data.setups.find((s) => s.id === form.setupId);
  const shownRules = chosenSetup ? rulesShown(chosenSetup.rules, form.ruleChecks) : [];
  const listedMistakes = mistakeList(data.settings);

  const preview = previewTrade(form);
  const closed = isClosed(preview) && preview.quantity > 0;
  const net = netPnl(preview);
  const r = rMultiple(preview);
  const risk = riskAmount(preview);
  const rr = plannedRR(preview);

  const entry = toNumberOrNull(form.entryPrice);
  const stop = toNumberOrNull(form.stopLoss);
  const stopWarning =
    entry != null &&
    stop != null &&
    ((form.side === 'LONG' && stop >= entry) || (form.side === 'SHORT' && stop <= entry))
      ? tr(form.side === 'LONG' ? 'form.stopAbove' : 'form.stopBelow')
      : null;

  const save = (addAnother: boolean) => {
    const result = validate(form, chosenSetup?.rules ?? [], trade);
    if (!result.input) {
      setErrors(result.errors);
      return;
    }
    discardCharts(result.input.screenshotFile);
    // a mistake named here goes on the list; one the trade already had stays off it, if it was taken off
    const named = (result.input.mistakes ?? []).filter(
      (m) => !listedMistakes.includes(m) && !trade?.mistakes?.includes(m),
    );
    if (named.length) actions.saveMistakes([...listedMistakes, ...named]);
    if (trade) {
      actions.updateTrade(trade.id, result.input);
      toast(tr('form.updated', { symbol: result.input.symbol }));
      onDone();
      return;
    }
    actions.addTrade(result.input);
    toast(tr('form.saved', { symbol: result.input.symbol }));
    if (addAnother) {
      setForm((f) => ({
        ...initialState(f.accountId),
        side: f.side,
        setupId: f.setupId,
        fees: f.fees,
        multiplier: f.multiplier,
      }));
      setErrors({});
    } else onDone();
  };

  const remove = async () => {
    if (!trade) return;
    const ok = await confirm({
      title: tr('form.delete.title'),
      message: tr('form.delete.message', {
        symbol: trade.symbol,
        side: tr(`side.${trade.side}`).toLowerCase(),
        time: isolate(trade.openedAt.replace('T', ' ')),
      }),
      confirmLabel: tr('form.delete.confirm'),
      tone: 'danger',
    });
    if (ok) {
      actions.deleteTrades([trade.id]);
      toast(tr('form.deleted'));
      onDone();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          save(false);
        }
      }}
    >
      {/* phone: one column, with the live result first so it stays in view while typing */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:gap-6">
        {/* --------------- left: the trade --------------- */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.1fr_1fr_auto]">
            <Field label={tr('form.symbol')} error={errors.symbol}>
              <Input
                autoFocus={!trade && storage.device === 'pc'}
                list="sj-symbols"
                value={form.symbol}
                onChange={(e) => set('symbol', e.target.value.toUpperCase())}
                // right to left, a list cut short in a narrow box loses its start ("…EURUSD, BTC"), so one symbol there
                placeholder={tr('goals.example', { n: language().dir === 'rtl' ? 'NVDA' : 'NVDA, EURUSD, BTC' })}
                invalid={Boolean(errors.symbol)}
                className="font-semibold uppercase placeholder:normal-case"
              />
              <datalist id="sj-symbols">
                {symbols.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label={tr('form.account')}>
              <Select value={form.accountId} onChange={(e) => set('accountId', e.target.value)}>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr('form.side')} className="col-span-2 md:col-span-1">
              <div className="grid h-10 grid-cols-2 rounded-md border border-line bg-app p-0.5 md:h-9">
                {(['LONG', 'SHORT'] as const).map((s) => {
                  const active = form.side === s;
                  const Icon = s === 'LONG' ? ArrowUpRight : ArrowDownRight;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('side', s)}
                      className={cn(
                        'flex items-center justify-center gap-1 rounded px-3 text-xs font-semibold transition',
                        active
                          ? s === 'LONG'
                            ? 'bg-profit/15 text-profit ring-1 ring-profit/30'
                            : 'bg-loss/15 text-loss ring-1 ring-loss/30'
                          : 'text-muted hover:text-fg',
                      )}
                    >
                      <Icon className="size-3.5" />
                      {tr(`side.${s}`)}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={tr('form.entryTime')} error={errors.openedAt}>
              <Input
                type="datetime-local"
                className="num"
                value={form.openedAt}
                onChange={(e) => set('openedAt', e.target.value)}
                invalid={Boolean(errors.openedAt)}
              />
            </Field>
            <Field label={tr('form.exitTime')} hint={tr('common.optional')} error={errors.closedAt}>
              <Input
                type="datetime-local"
                className="num"
                value={form.closedAt}
                onChange={(e) => set('closedAt', e.target.value)}
                invalid={Boolean(errors.closedAt)}
              />
            </Field>
          </div>

          <div className={ROW3}>
            <Field className={IN_ROW3} label={tr('form.quantity')} error={errors.quantity}>
              <Input
                inputMode="decimal"
                className="num"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                placeholder="0"
                invalid={Boolean(errors.quantity)}
              />
            </Field>
            <Field className={IN_ROW3} label={tr('form.entryPrice')} error={errors.entryPrice}>
              <Input
                inputMode="decimal"
                className="num"
                value={form.entryPrice}
                onChange={(e) => set('entryPrice', e.target.value)}
                placeholder="0.00"
                invalid={Boolean(errors.entryPrice)}
              />
            </Field>
            <Field
              className={IN_ROW3}
              label={tr('form.exitPrice')}
              hint={<span className="max-md:hidden">{tr('form.emptyIsOpen')}</span>}
              error={errors.exitPrice}
            >
              <Input
                inputMode="decimal"
                className="num"
                value={form.exitPrice}
                onChange={(e) => set('exitPrice', e.target.value)}
                placeholder="0.00"
                disabled={form.pnlMode === 'manual'}
              />
            </Field>
          </div>

          <div className={ROW3}>
            <Field className={IN_ROW3} label={tr('form.stopLoss')} hint={tr('common.optional')} error={errors.stopLoss}>
              <Input
                inputMode="decimal"
                className="num"
                value={form.stopLoss}
                onChange={(e) => set('stopLoss', e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field
              className={IN_ROW3}
              label={tr('form.takeProfit')}
              hint={tr('common.optional')}
              error={errors.takeProfit}
            >
              <Input
                inputMode="decimal"
                className="num"
                value={form.takeProfit}
                onChange={(e) => set('takeProfit', e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field
              className={IN_ROW3}
              label={
                <>
                  {tr('form.fees')}
                  <span className="max-md:hidden">{tr('form.feesTail')}</span>
                </>
              }
              error={errors.fees}
            >
              <Input
                inputMode="decimal"
                className="num"
                value={form.fees}
                onChange={(e) => set('fees', e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>
          {stopWarning && (
            <p className="-mt-2 flex items-center gap-1.5 text-xs text-warn">
              <TriangleAlert className="size-3.5" /> {stopWarning}
            </p>
          )}

          <div className={ROW3}>
            <Field
              className={IN_ROW3}
              label={tr('form.setup')}
              hint={data.setups.length ? undefined : tr('form.addInPlaybook')}
            >
              <Select value={form.setupId} onChange={(e) => set('setupId', e.target.value)}>
                <option value="">{tr('form.noSetup')}</option>
                {data.setups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              className={IN_ROW3}
              label={tr('form.session')}
              hint={!form.sessionTouched && form.session ? tr('form.fromEntryTime') : undefined}
            >
              <Select
                value={form.session}
                onChange={(e) => setForm((f) => ({ ...f, session: e.target.value, sessionTouched: true }))}
              >
                <option value="">{tr('form.none')}</option>
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    {sessionName(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className={IN_ROW3} label={tr('form.leverage')} hint={tr('common.optional')}>
              {/* "1 ×" reads left to right in every language, as the number in it does */}
              <div className="relative" dir="ltr">
                <Input
                  inputMode="decimal"
                  className="num pe-7"
                  value={form.leverage}
                  onChange={(e) => set('leverage', e.target.value)}
                  placeholder="1"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-faint">
                  ×
                </span>
              </div>
            </Field>
          </div>

          {chosenSetup && shownRules.length > 0 && (
            <RuleChecklist
              setupName={chosenSetup.name}
              rules={shownRules}
              setupRules={chosenSetup.rules}
              value={form.ruleChecks}
              onChange={(ruleChecks) => setForm((f) => ({ ...f, ruleChecks, rulesTouched: true }))}
            />
          )}

          <MistakeChips
            shown={mistakesShown(listedMistakes, trade?.mistakes)}
            listed={listedMistakes}
            value={form.mistakes}
            onChange={(mistakes) => set('mistakes', mistakes)}
          />

          <Field label={tr('form.tags')} hint={tr('form.tagsHint')}>
            <TagInput
              value={form.tags}
              onChange={(tags) => set('tags', tags)}
              suggestions={tagSuggestions}
              arrange={(shown) => arrangeByGroup(shown, data.settings.tagGroups ?? [])}
            />
          </Field>

          <Field label={tr('form.notes')}>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={tr('form.notesPlaceholder')}
            />
          </Field>

          <div className="rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm text-muted transition hover:text-fg"
            >
              {tr('form.advanced')}
              <ChevronDown className={cn('size-4 transition', showAdvanced && 'rotate-180')} />
            </button>
            {showAdvanced && (
              <div className="grid grid-flow-row-dense grid-cols-2 gap-3 border-t border-line p-3 md:grid-flow-row md:grid-cols-3">
                <Field label={tr('form.multiplier')} hint={tr('form.multiplierHint')} error={errors.multiplier}>
                  <Input
                    inputMode="decimal"
                    className="num"
                    value={form.multiplier}
                    onChange={(e) => set('multiplier', e.target.value)}
                    placeholder="1"
                  />
                </Field>
                <Field label={tr('form.pnlMode')} className="col-span-2 md:col-span-1">
                  <SegmentedControl
                    className="flex h-10 w-full md:h-9 [&>button]:flex-1 [&>button]:justify-center"
                    value={form.pnlMode}
                    onChange={(v) => set('pnlMode', v)}
                    options={[
                      { value: 'auto', label: tr('form.fromPrices') },
                      { value: 'manual', label: tr('form.manual') },
                    ]}
                  />
                </Field>
                <Field label={tr('form.grossPnl')} hint={tr('form.beforeFees')} error={errors.manualPnl}>
                  <Input
                    inputMode="decimal"
                    className="num"
                    value={form.manualPnl}
                    onChange={(e) => set('manualPnl', e.target.value)}
                    placeholder="0.00"
                    disabled={form.pnlMode !== 'manual'}
                  />
                </Field>
                <p className="col-span-2 text-xs leading-relaxed text-faint md:col-span-3">
                  {tr('form.multiplierExamples', { lot: formatNumber(100000, 0) })}
                </p>
                <Field
                  label={tr('form.chartLink')}
                  hint={tr('form.chartLinkHint')}
                  className="col-span-2 md:col-span-3"
                >
                  <Input
                    value={form.screenshotUrl}
                    onChange={(e) => set('screenshotUrl', e.target.value)}
                    placeholder="https://www.tradingview.com/x/…"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* --------------- right: live result --------------- */}
        {/* on a phone this column dissolves: the result goes first, the chart and review after the form */}
        <div className="max-md:contents md:space-y-4">
          <div className="rounded-lg border border-line bg-app p-3 max-md:order-first md:p-4">
            <div className="text-xs text-muted">{closed ? tr('form.netPnl') : tr('form.position')}</div>
            <div
              className={cn(
                'num mt-1 text-2xl font-semibold leading-8 md:text-[30px] md:leading-9',
                !closed ? 'text-accent' : net > 0 ? 'text-profit' : net < 0 ? 'text-loss' : 'text-fg',
              )}
            >
              {closed ? formatMoney(net, currency, { sign: true }) : tr('form.open')}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs md:mt-4 md:block md:space-y-2 md:text-sm">
              {(
                [
                  [tr('form.grossPnl'), closed ? formatMoney(grossPnl(preview), currency, { sign: true }) : '—'],
                  [tr('form.fees'), formatMoney(-(preview.fees || 0), currency)],
                  [tr('form.rMultiple'), r == null ? '—' : formatR(r)],
                  [tr('form.risk'), risk == null ? '—' : formatMoney(risk, currency)],
                  [tr('form.plannedRR'), rr == null ? '—' : isolate(`1:${formatRatio(rr)}`)],
                  [tr('form.holdTime'), formatDuration(holdMinutes(preview))],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-muted">{label}</dt>
                  <dd className="num text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ChartImage
            file={form.screenshotFile}
            onChange={(name) => {
              if (name) uploaded.current.add(name);
              set('screenshotFile', name);
            }}
            onError={(message) => toast(message, 'error')}
          />

          <div className="rounded-lg border border-line p-4">
            <div className="text-sm font-medium text-fg">{tr('form.selfReview')}</div>
            <p className="mb-3 mt-0.5 text-xs text-muted">{tr('form.selfReviewHint')}</p>
            <div className="space-y-2.5">
              <RatingInput
                label={tr('score.discipline')}
                value={form.discipline}
                onChange={(v) => set('discipline', v)}
              />
              <RatingInput label={tr('score.execution')} value={form.execution} onChange={(v) => set('execution', v)} />
              <RatingInput label={tr('score.patience')} value={form.patience} onChange={(v) => set('patience', v)} />
            </div>
          </div>
        </div>
      </div>

      {/* on a phone the buttons stay pinned to the bottom while the form scrolls */}
      <div className="-mx-5 -mb-4 mt-5 flex items-center gap-2 border-t border-line px-5 py-3 max-md:pb-safe-3 max-md:sticky max-md:bottom-[-1rem] max-md:bg-surface">
        {trade && (
          <Button variant="ghost" className="text-loss hover:bg-loss/10 hover:text-loss" onClick={remove}>
            <Trash2 className="size-4" /> {tr('common.delete')}
          </Button>
        )}
        <span className="flex-1 md:hidden" />
        <span className="ms-auto me-2 text-xs text-faint max-md:hidden">{tr('form.ctrlEnter')}</span>
        <Button variant="ghost" className="max-md:hidden" onClick={onDone}>
          {tr('common.cancel')}
        </Button>
        {!trade && (
          <Button variant="secondary" onClick={() => save(true)}>
            <span>
              {tr('form.save')}
              <span className="max-md:hidden">{tr('form.saveAnotherTail')}</span>
              <span className="md:hidden">{tr('form.saveNextTail')}</span>
            </span>
          </Button>
        )}
        <Button variant="primary" type="submit">
          {trade ? tr('form.saveChanges') : tr('form.saveTrade')}
        </Button>
      </div>
    </form>
  );
}
