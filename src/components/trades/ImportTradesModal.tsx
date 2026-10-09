'use client';

import { useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, FileSpreadsheet, Info, Merge, TriangleAlert, Upload } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { CSV_COLUMNS, csvTemplate, describeGaps, importTradesFromCsv } from '@/lib/csv';
import { formatMoney, formatPrice, formatShortDate, formatTime } from '@/lib/format';
import { isClosed, netPnl } from '@/lib/trade-math';
import { cn, downloadFile } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { PnlValue, SideBadge, StatusBadge } from '@/components/ui/StatusBadge';

export function ImportTradesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Import trades from CSV"
      description="Drop in an export from your broker. Only a symbol column is required — anything missing can be filled in afterwards."
    >
      <ImportBody onClose={onClose} />
    </Modal>
  );
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
          })
        : null,
    [text, accountId, data.accounts, data.setups, data.trades, combinePartials],
  );

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  };

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
          Works with Tradovate performance exports and most broker reports, as well as the template above.
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
            Only <span className="num text-fg">symbol</span> is required. Everything else is optional:{' '}
            <span className="num">{CSV_COLUMNS.filter((c) => c !== 'symbol').join(', ')}</span>.
          </p>
          <p>
            Broker wording is recognised too — <span className="num">qty</span>, <span className="num">ticker</span>,{' '}
            <span className="num">commission</span>, <span className="num">realized pnl</span>, and the paired{' '}
            <span className="num">buyPrice / sellPrice / boughtTimestamp / soldTimestamp</span> columns that futures
            platforms export. Separate several tags with a | character.
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
            actions.importTrades(result.trades, result.newSetups);
            toast(
              result.incomplete > 0
                ? `Imported ${result.trades.length} trades — ${result.incomplete} need details`
                : `Imported ${result.trades.length} trades`,
              result.incomplete > 0 ? 'info' : 'success',
            );
            onClose();
          }}
        >
          Import {result?.trades.length ? `${result.trades.length} trades` : 'trades'}
        </Button>
      </div>
    </div>
  );
}
