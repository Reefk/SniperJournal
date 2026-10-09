'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Trash2, TriangleAlert } from 'lucide-react';
import type { Side, Trade, TradeInput } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { detectSession, SESSIONS } from '@/lib/sessions';
import { formatDuration, formatMoney, formatRatio } from '@/lib/format';
import { grossPnl, holdMinutes, isClosed, netPnl, plannedRR, riskAmount, rMultiple } from '@/lib/trade-math';
import { cn, toLocalInput, toNumberOrNull } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { TagInput } from '@/components/ui/TagInput';
import { RatingInput } from '@/components/ui/RatingInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ChartImage } from './ChartImage';

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
    tags: src.tags ?? [],
    notes: src.notes ?? '',
    screenshotUrl: src.screenshotUrl ?? '',
    screenshotFile: src.screenshotFile,
    discipline: src.review?.discipline,
    execution: src.review?.execution,
    patience: src.review?.patience,
  };
}

function validate(f: FormState, editing?: Trade): { errors: Errors; input?: TradeInput } {
  const errors: Errors = {};
  const symbol = f.symbol.trim().toUpperCase();
  const quantity = toNumberOrNull(f.quantity);
  const entryPrice = toNumberOrNull(f.entryPrice);
  const exitPrice = toNumberOrNull(f.exitPrice);
  const multiplier = toNumberOrNull(f.multiplier) ?? 1;
  const manualPnl = f.pnlMode === 'manual' ? toNumberOrNull(f.manualPnl) : null;

  if (!symbol) errors.symbol = 'Enter a symbol';
  if (!f.openedAt) errors.openedAt = 'Enter the entry time';
  if (quantity == null || quantity <= 0) errors.quantity = 'Must be more than 0';
  if (entryPrice == null) errors.entryPrice = 'Enter the entry price';
  if (f.exitPrice.trim() && exitPrice == null) errors.exitPrice = 'Not a number';
  if (f.stopLoss.trim() && toNumberOrNull(f.stopLoss) == null) errors.stopLoss = 'Not a number';
  if (f.takeProfit.trim() && toNumberOrNull(f.takeProfit) == null) errors.takeProfit = 'Not a number';
  if (f.fees.trim() && toNumberOrNull(f.fees) == null) errors.fees = 'Not a number';
  if (multiplier <= 0) errors.multiplier = 'Must be more than 0';
  if (f.pnlMode === 'manual' && manualPnl == null) errors.manualPnl = 'Enter the gross P&L';
  if (f.closedAt && f.openedAt && f.closedAt < f.openedAt) errors.closedAt = 'Exit is before entry';

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

export function TradeFormModal() {
  const { tradeForm, closeTradeForm } = useUI();
  const editing = tradeForm.trade;
  return (
    <Modal
      open={tradeForm.open}
      onClose={closeTradeForm}
      closeOnBackdrop={false}
      size="xl"
      phone="full"
      title={editing ? `Edit ${editing.symbol} trade` : 'Log a trade'}
      description={
        editing
          ? 'Changes are saved to your journal immediately.'
          : 'Leave the exit price empty if the position is still open.'
      }
    >
      <TradeForm key={tradeForm.nonce} trade={editing} defaults={tradeForm.defaults} onDone={closeTradeForm} />
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
  const [showAdvanced, setShowAdvanced] = useState(() =>
    Boolean(trade && (trade.manualPnl != null || (trade.multiplier && trade.multiplier !== 1) || trade.screenshotUrl)),
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'openedAt' && !f.sessionTouched) next.session = detectSession(String(value));
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
      ? `Your stop is ${form.side === 'LONG' ? 'above' : 'below'} the entry for a ${form.side.toLowerCase()}`
      : null;

  const save = (addAnother: boolean) => {
    const result = validate(form, trade);
    if (!result.input) {
      setErrors(result.errors);
      return;
    }
    if (trade) {
      actions.updateTrade(trade.id, result.input);
      toast(`${result.input.symbol} trade updated`);
      onDone();
      return;
    }
    actions.addTrade(result.input);
    toast(`${result.input.symbol} trade saved`);
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
      title: 'Delete this trade?',
      message: `${trade.symbol} ${trade.side.toLowerCase()} from ${trade.openedAt.replace('T', ' ')} will be permanently removed.`,
      confirmLabel: 'Delete trade',
      tone: 'danger',
    });
    if (ok) {
      actions.deleteTrades([trade.id]);
      toast('Trade deleted');
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
            <Field label="Symbol" error={errors.symbol}>
              <Input
                autoFocus={!trade && storage.kind === 'web'}
                list="sj-symbols"
                value={form.symbol}
                onChange={(e) => set('symbol', e.target.value.toUpperCase())}
                placeholder="e.g. NVDA, EURUSD, BTC"
                invalid={Boolean(errors.symbol)}
                className="font-semibold uppercase"
              />
              <datalist id="sj-symbols">
                {symbols.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Account">
              <Select value={form.accountId} onChange={(e) => set('accountId', e.target.value)}>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Side" className="col-span-2 md:col-span-1">
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
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Entry time" error={errors.openedAt}>
              <Input
                type="datetime-local"
                className="num"
                value={form.openedAt}
                onChange={(e) => set('openedAt', e.target.value)}
                invalid={Boolean(errors.openedAt)}
              />
            </Field>
            <Field label="Exit time" hint="optional" error={errors.closedAt}>
              <Input
                type="datetime-local"
                className="num"
                value={form.closedAt}
                onChange={(e) => set('closedAt', e.target.value)}
                invalid={Boolean(errors.closedAt)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity" error={errors.quantity}>
              <Input
                inputMode="decimal"
                className="num"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                placeholder="0"
                invalid={Boolean(errors.quantity)}
              />
            </Field>
            <Field label="Entry price" error={errors.entryPrice}>
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
              label="Exit price"
              hint={<span className="max-md:hidden">empty = open</span>}
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

          <div className="grid grid-cols-3 gap-3">
            <Field label="Stop loss" hint="optional" error={errors.stopLoss}>
              <Input
                inputMode="decimal"
                className="num"
                value={form.stopLoss}
                onChange={(e) => set('stopLoss', e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Take profit" hint="optional" error={errors.takeProfit}>
              <Input
                inputMode="decimal"
                className="num"
                value={form.takeProfit}
                onChange={(e) => set('takeProfit', e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field
              label={
                <>
                  Fees<span className="max-md:hidden"> & commissions</span>
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

          <div className="grid grid-cols-3 gap-3">
            <Field label="Setup" hint={data.setups.length ? undefined : 'add in Playbook'}>
              <Select value={form.setupId} onChange={(e) => set('setupId', e.target.value)}>
                <option value="">No setup</option>
                {data.setups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Session" hint={!form.sessionTouched && form.session ? 'from entry time' : undefined}>
              <Select
                value={form.session}
                onChange={(e) => setForm((f) => ({ ...f, session: e.target.value, sessionTouched: true }))}
              >
                <option value="">None</option>
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Leverage" hint="optional">
              <div className="relative">
                <Input
                  inputMode="decimal"
                  className="num pr-7"
                  value={form.leverage}
                  onChange={(e) => set('leverage', e.target.value)}
                  placeholder="1"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
                  ×
                </span>
              </div>
            </Field>
          </div>

          <Field label="Tags" hint="mistakes, catalysts, emotions">
            <TagInput value={form.tags} onChange={(tags) => set('tags', tags)} suggestions={tagSuggestions} />
          </Field>

          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Why you took it, how you managed it, what you would do differently"
            />
          </Field>

          <div className="rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm text-muted transition hover:text-fg"
            >
              Futures, forex and manual P&L
              <ChevronDown className={cn('size-4 transition', showAdvanced && 'rotate-180')} />
            </button>
            {showAdvanced && (
              <div className="grid grid-flow-row-dense grid-cols-2 gap-3 border-t border-line p-3 md:grid-flow-row md:grid-cols-3">
                <Field label="Contract multiplier" hint="1 = shares" error={errors.multiplier}>
                  <Input
                    inputMode="decimal"
                    className="num"
                    value={form.multiplier}
                    onChange={(e) => set('multiplier', e.target.value)}
                    placeholder="1"
                  />
                </Field>
                <Field label="P&L calculation" className="col-span-2 md:col-span-1">
                  <SegmentedControl
                    className="flex h-10 w-full md:h-9 [&>button]:flex-1 [&>button]:justify-center"
                    value={form.pnlMode}
                    onChange={(v) => set('pnlMode', v)}
                    options={[
                      { value: 'auto', label: 'From prices' },
                      { value: 'manual', label: 'Manual' },
                    ]}
                  />
                </Field>
                <Field label="Gross P&L" hint="before fees" error={errors.manualPnl}>
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
                  Multiplier examples: ES = 50, NQ = 20, MES = 5, one standard forex lot = 100,000 units. Use manual P&L
                  when copying the figure straight from your broker is simpler.
                </p>
                <Field
                  label="Chart link"
                  hint="instead of, or alongside, an uploaded image"
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
            <div className="text-xs text-muted">{closed ? 'Net P&L' : 'Position'}</div>
            <div
              className={cn(
                'num mt-1 text-2xl font-semibold leading-8 md:text-[30px] md:leading-9',
                !closed ? 'text-accent' : net > 0 ? 'text-profit' : net < 0 ? 'text-loss' : 'text-fg',
              )}
            >
              {closed ? formatMoney(net, currency, { sign: true }) : 'Open'}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs md:mt-4 md:block md:space-y-2 md:text-sm">
              {(
                [
                  ['Gross P&L', closed ? formatMoney(grossPnl(preview), currency, { sign: true }) : '—'],
                  ['Fees', formatMoney(-(preview.fees || 0), currency)],
                  ['R multiple', r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`],
                  ['Risk', risk == null ? '—' : formatMoney(risk, currency)],
                  ['Planned R:R', rr == null ? '—' : `1:${formatRatio(rr)}`],
                  ['Hold time', formatDuration(holdMinutes(preview))],
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
            onChange={(name) => set('screenshotFile', name)}
            onError={(message) => toast(message, 'error')}
          />

          <div className="rounded-lg border border-line p-4">
            <div className="text-sm font-medium text-fg">Self-review</div>
            <p className="mb-3 mt-0.5 text-xs text-muted">Rate 1–5. Feeds your Sniper Score.</p>
            <div className="space-y-2.5">
              <RatingInput label="Discipline" value={form.discipline} onChange={(v) => set('discipline', v)} />
              <RatingInput label="Execution" value={form.execution} onChange={(v) => set('execution', v)} />
              <RatingInput label="Patience" value={form.patience} onChange={(v) => set('patience', v)} />
            </div>
          </div>
        </div>
      </div>

      {/* on a phone the buttons stay pinned to the bottom while the form scrolls */}
      <div className="-mx-5 -mb-4 mt-5 flex items-center gap-2 border-t border-line px-5 py-3 max-md:pb-safe-3 max-md:sticky max-md:bottom-[-1rem] max-md:bg-surface">
        {trade && (
          <Button variant="ghost" className="text-loss hover:bg-loss/10 hover:text-loss" onClick={remove}>
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
        <span className="flex-1 md:hidden" />
        <span className="ml-auto mr-2 text-xs text-faint max-md:hidden">Ctrl + Enter to save</span>
        <Button variant="ghost" className="max-md:hidden" onClick={onDone}>
          Cancel
        </Button>
        {!trade && (
          <Button variant="secondary" onClick={() => save(true)}>
            <span>
              Save<span className="max-md:hidden"> and log another</span>
              <span className="md:hidden"> + next</span>
            </span>
          </Button>
        )}
        <Button variant="primary" type="submit">
          {trade ? 'Save changes' : 'Save trade'}
        </Button>
      </div>
    </form>
  );
}
