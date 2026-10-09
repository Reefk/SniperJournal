'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, FileSpreadsheet, Info, Merge, TriangleAlert, Upload } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { ROLE_LABELS, csvTemplate, describeGaps, importTradesFromCsv, type DateOrder, type Role } from '@/lib/csv';
import { formatPrice, formatShortDate, formatTime } from '@/lib/format';
import { isClosed, netPnl } from '@/lib/trade-math';
import { cn, downloadFile } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { PnlValue, SideBadge, StatusBadge } from '@/components/ui/StatusBadge';

export function ImportTradesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Import trades from CSV"
      description="Drop in an export from your broker or trading platform: whole trades or individual fills. Anything missing can be filled in afterwards."
    >
      <ImportBody onClose={onClose} />
    </Modal>
  );
}

/** what you told the importer about a file, beyond what it worked out itself */
interface Choices {
  /** column index -> what it is */
  mapping: Record<number, Role | ''>;
  rowKind?: 'trades' | 'fills';
  dateOrder?: DateOrder;
  /** for files with no symbol column */
  defaultSymbol: string;
}
const AUTOMATIC: Choices = { mapping: {}, defaultSymbol: '' };
const tradesWord = (n: number) => `${n} ${n === 1 ? 'trade' : 'trades'}`;
const isAutomatic = (c: Choices) => !Object.keys(c.mapping).length && !c.rowKind && !c.dateOrder && !c.defaultSymbol;

/**
 * Choices are remembered per layout of columns, on this device only, so the
 * next export from the same broker reads the same way without asking again.
 */
const CHOICES_KEY = 'sniper-journal:csv-layout:';
function rememberedChoices(signature: string): Choices | null {
  try {
    const raw = localStorage.getItem(CHOICES_KEY + signature);
    return raw ? { ...AUTOMATIC, ...(JSON.parse(raw) as Partial<Choices>) } : null;
  } catch {
    return null;
  }
}
function rememberChoices(signature: string, choices: Choices) {
  try {
    if (isAutomatic(choices)) localStorage.removeItem(CHOICES_KEY + signature);
    else localStorage.setItem(CHOICES_KEY + signature, JSON.stringify(choices));
  } catch {
    /* storage unavailable: the choices simply are not remembered */
  }
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const { data, actions } = useJournal();
  const { toast } = useUI();
  const [accountId, setAccountId] = useState(
    data.activeAccountId === 'all' ? data.accounts[0].id : data.activeAccountId,
  );
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [combinePartials, setCombinePartials] = useState(true);
  const [choices, setChoices] = useState<Choices>(AUTOMATIC);
  /** the layout whose remembered choices have been looked up */
  const [lookedUp, setLookedUp] = useState('');
  const [restored, setRestored] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const currency = data.settings.currency;

  const result = useMemo(
    () =>
      text
        ? importTradesFromCsv(text, {
            accountId,
            accounts: data.accounts,
            setups: data.setups,
            existing: data.trades,
            combinePartials,
            mapping: choices.mapping,
            rowKind: choices.rowKind,
            dateOrder: choices.dateOrder,
            defaultSymbol: choices.defaultSymbol,
          })
        : null,
    [text, accountId, data.accounts, data.setups, data.trades, combinePartials, choices],
  );
  const layout = result?.layout ?? null;

  // a layout seen before reads the way it was set up last time
  useEffect(() => {
    if (!layout || layout.signature === lookedUp) return;
    setLookedUp(layout.signature);
    const saved = rememberedChoices(layout.signature);
    setRestored(Boolean(saved));
    if (saved) setChoices(saved);
  }, [layout, lookedUp]);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setChoices(AUTOMATIC);
    setLookedUp('');
    setRestored(false);
    setShowColumns(false);
    setText(await file.text());
  };

  const setRole = (index: number, role: Role | '') =>
    setChoices((c) => ({ ...c, mapping: { ...c.mapping, [index]: role } }));
  const noSymbolColumn = Boolean(layout && !layout.columns.some((c) => c.role === 'symbol' || c.role === 'underlying'));
  const used = layout?.columns.filter((c) => c.role).length ?? 0;

  const preview = result?.trades.slice(0, 6) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto]">
        <Field label="Import into account" hint="a matching account column overrides this">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={() => downloadFile('sniper-journal-template.csv', csvTemplate(), 'text/csv')}>
          <FileSpreadsheet className="size-4" /> Download template
        </Button>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void readFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition',
          dragging ? 'border-accent bg-accent/5' : 'border-line-strong hover:border-accent/60',
        )}
      >
        <Upload className="size-5 text-muted" />
        <span className="mt-2 text-sm text-fg">
          {fileName || (
            <>
              <span className="md:hidden">Tap to choose a .csv file</span>
              <span className="max-md:hidden">Drop a .csv file here, or click to choose one</span>
            </>
          )}
        </span>
        <span className="mt-1 text-xs text-faint">
          Works with exports from most brokers and platforms, whole trades or individual fills, as well as the template
          above.
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
      </label>

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-app px-4 py-3 text-sm">
            <span className="flex items-center gap-2 text-fg">
              <CircleCheck className="size-4 text-profit" />
              <span className="num font-semibold">{result.trades.length}</span> ready to import
            </span>
            {result.duplicates > 0 && (
              <span className="flex items-center gap-2 text-muted">
                <Info className="size-4 text-accent" />
                <span className="num">{result.duplicates}</span> already in your journal, skipped
              </span>
            )}
            {result.incomplete > 0 && (
              <span className="flex items-center gap-2 text-warn">
                <TriangleAlert className="size-4" />
                <span className="num">{result.incomplete}</span> need details before they count
              </span>
            )}
            {result.combined > 0 && (
              <span className="flex items-center gap-2 text-muted">
                <Merge className="size-4 text-accent" />
                <span className="num">{result.combined}</span> partial fills folded into whole positions
              </span>
            )}
            {result.newSetups.length > 0 && (
              <span className="text-muted">{result.newSetups.length} new playbook setups will be created</span>
            )}
          </div>

          {result.notices.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-accent/25 bg-accent/5 px-4 py-2.5 text-xs leading-relaxed text-muted">
              {result.notices.map((notice, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Info className="mt-px size-3.5 shrink-0 text-accent" />
                  <span>{notice}</span>
                </li>
              ))}
            </ul>
          )}

          {layout && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(layout.canBeFills || layout.rowKind === 'fills') && (
                <Field label="Each row is">
                  <Select
                    value={layout.rowKind === 'fills' ? 'fills' : 'trades'}
                    onChange={(e) => setChoices((c) => ({ ...c, rowKind: e.target.value as 'trades' | 'fills' }))}
                  >
                    <option value="trades">A whole trade</option>
                    <option value="fills">One fill (put together into trades)</option>
                  </Select>
                </Field>
              )}
              {(layout.ambiguousDates || choices.dateOrder) && (
                <Field label="Dates like 03/04/2026 are">
                  <Select
                    value={layout.dateOrder ?? 'mdy'}
                    onChange={(e) => setChoices((c) => ({ ...c, dateOrder: e.target.value as DateOrder }))}
                  >
                    <option value="mdy">Month first: March 4</option>
                    <option value="dmy">Day first: 3 April</option>
                  </Select>
                </Field>
              )}
              {noSymbolColumn && (
                <Field label="Symbol for every row" hint="this file has none">
                  <Input
                    value={choices.defaultSymbol}
                    onChange={(e) => setChoices((c) => ({ ...c, defaultSymbol: e.target.value }))}
                    placeholder="e.g. ES"
                  />
                </Field>
              )}
            </div>
          )}

          {layout && (
            <details
              open={showColumns || (noSymbolColumn && !choices.defaultSymbol)}
              onToggle={(e) => setShowColumns(e.currentTarget.open)}
              className="rounded-lg border border-line"
            >
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-muted hover:text-fg">
                Columns: {used} of {layout.columns.length} used
                {restored ? ', as you set them for this layout last time' : ''}
              </summary>
              <div className="max-h-72 space-y-2 overflow-y-auto border-t border-line px-4 py-3">
                <p className="text-xs leading-relaxed text-faint">
                  Change what a column is read as if the importer got it wrong. Your choices are remembered on this
                  device for files with the same columns.
                </p>
                {layout.columns.map((column) => (
                  <div key={column.index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-fg">{column.header || `Column ${column.index + 1}`}</div>
                      <div className="num truncate text-[11px] text-faint">{column.sample || '—'}</div>
                    </div>
                    <Select
                      aria-label={`What "${column.header || `column ${column.index + 1}`}" is`}
                      value={column.role}
                      onChange={(e) => setRole(column.index, e.target.value as Role | '')}
                    >
                      <option value="">Not used</option>
                      {ROLE_LABELS.map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
                {!isAutomatic(choices) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setChoices(AUTOMATIC);
                      setRestored(false);
                      if (layout) rememberChoices(layout.signature, AUTOMATIC);
                    }}
                  >
                    Back to automatic
                  </Button>
                )}
              </div>
            </details>
          )}

          {result.pairedFills && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0"
                checked={combinePartials}
                onChange={(e) => setCombinePartials(e.target.checked)}
              />
              <span>
                <span className="text-fg">Combine partial exits into one trade</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  When you scale out, the broker writes one row per exit. With this on, rows that share an entry fill
                  become a single position: the sizes add up, the prices become size-weighted averages, and the P&amp;L
                  stays exactly the sum of the parts.
                </span>
              </span>
            </label>
          )}

          {result.pairedFills && result.trades.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/5 px-4 py-2.5 text-xs leading-relaxed text-muted">
              <Info className="mt-px size-3.5 shrink-0 text-accent" />
              <span>
                This export pairs a buy fill with a sell fill instead of naming a direction, so the fill that happened
                first is treated as the entry. Where the file reports a P&amp;L, the contract multiplier is worked out
                from it, which is how a 2-lot MNQ trade comes out at $2 a point. Check a row or two below before
                importing.
              </span>
            </p>
          )}

          {preview.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-line max-md:overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm md:whitespace-normal">
                <thead className="border-b border-line bg-app/50 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Symbol</th>
                    <th className="px-3 py-2 text-left font-medium">Side</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Entry</th>
                    <th className="px-3 py-2 text-right font-medium">Exit</th>
                    <th className="px-3 py-2 text-right font-medium">P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.map((t) => (
                    <tr key={t.id} className={cn(t.needsReview && 'bg-warn/5')}>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">
                        {t.openedAt ? (
                          <>
                            {formatShortDate(t.openedAt)}{' '}
                            <span className="num text-xs text-faint">{formatTime(t.openedAt)}</span>
                          </>
                        ) : (
                          <StatusBadge tone="warn">no date</StatusBadge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold text-fg">
                        {t.symbol}
                        {(t.fillCount ?? 1) > 1 && (
                          <span className="ml-1.5 text-[11px] font-normal text-accent">{t.fillCount} fills</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <SideBadge side={t.side} />
                      </td>
                      <td className="num px-3 py-2 text-right text-fg">{t.quantity || '—'}</td>
                      <td className="num px-3 py-2 text-right text-muted">
                        {t.entryPrice ? formatPrice(t.entryPrice) : '—'}
                      </td>
                      <td className="num px-3 py-2 text-right text-muted">{formatPrice(t.exitPrice)}</td>
                      <td className="px-3 py-2 text-right">
                        {t.needsReview ? (
                          <span className="text-xs text-warn">{describeGaps(t)}</span>
                        ) : (
                          <PnlValue value={netPnl(t)} open={!isClosed(t)} currency={currency} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.trades.length > preview.length && (
                <div className="border-t border-line px-3 py-2 text-xs text-faint">
                  …and {result.trades.length - preview.length} more rows.
                </div>
              )}
            </div>
          )}

          {result.ignored.length > 0 && (
            <p className="text-xs text-faint">
              Columns not used: <span className="num">{result.ignored.join(', ')}</span>. Nothing was lost — those
              simply have no place in the journal.
            </p>
          )}

          {result.errors.length > 0 && (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-loss/30 bg-loss/5 p-3">
              {result.errors.slice(0, 30).map((err, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs text-loss">
                  <CircleAlert className="mt-px size-3.5 shrink-0" /> {err}
                </p>
              ))}
              {result.errors.length > 30 && (
                <p className="text-xs text-muted">…and {result.errors.length - 30} more.</p>
              )}
            </div>
          )}
        </>
      )}

      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none text-sm text-muted hover:text-fg">
          Which columns are understood
        </summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>
            Only a <span className="text-fg">symbol</span> is required, and for a file without one (TradingView&apos;s
            list of trades) you can type it in. Everything else is optional.
          </p>
          <p>
            A file can list <span className="text-fg">whole trades</span>, with the entry and the exit on one row, or{' '}
            <span className="text-fg">individual fills</span>, one buy or sell per row. Fills are put back together by
            following the position in each symbol: scaling in and out stays one trade, and a position still open at the
            end of the file is imported as open.
          </p>
          <p>
            Column names are recognised in the many forms brokers use — <span className="num">Qty</span>,{' '}
            <span className="num">Filled</span>, <span className="num">Market pos.</span>,{' '}
            <span className="num">Comm/Fee</span>, <span className="num">Net P&amp;L (USD)</span>,{' '}
            <span className="num">Date/Time</span>, separate date and time columns — and several fee columns add up.
            Title lines above the table and total lines below it are skipped. Anything read wrongly can be changed
            under Columns. Separate several tags with a | character.
          </p>
          <p>
            What one point is worth comes from a multiplier column, the amount against the price, or the file&apos;s
            P&amp;L. Failing those, futures are recognised from a full contract code such as ESH6 or MNQ 03-26, and
            options count 100 shares. The preview says whenever it worked one out this way.
          </p>
          <p>
            Rows that are missing a date, quantity or entry price still import. They are marked{' '}
            <span className="text-warn">needs details</span>, kept out of every statistic, and listed at the top of the
            Trades page so you can complete them by hand.
          </p>
        </div>
      </details>

      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!result?.trades.length}
          onClick={() => {
            if (!result?.trades.length) return;
            if (layout) rememberChoices(layout.signature, choices);
            actions.importTrades(result.trades, result.newSetups);
            toast(
              result.incomplete > 0
                ? `Imported ${tradesWord(result.trades.length)} — ${result.incomplete} need details`
                : `Imported ${tradesWord(result.trades.length)}`,
              result.incomplete > 0 ? 'info' : 'success',
            );
            onClose();
          }}
        >
          Import {result?.trades.length ? tradesWord(result.trades.length) : 'trades'}
        </Button>
      </div>
    </div>
  );
}
