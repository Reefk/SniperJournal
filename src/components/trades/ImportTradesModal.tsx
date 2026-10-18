'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CopyCheck,
  FileSpreadsheet,
  Info,
  Merge,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import {
  PLATFORMS,
  ROLE_LABELS,
  WorkbookError,
  csvTemplate,
  describeGaps,
  fileTooLarge,
  importTradesFromCsv,
  isOldExcel,
  isZip,
  likeliestSheet,
  readWorkbook,
  sheetToCsv,
  sheetTooLarge,
  type DateOrder,
  type PlatformGroup,
  type Role,
  type WorkbookSheet,
} from '@/lib/csv';
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
      title="Import trades from a file"
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
/** what the file picker offers: CSV and its tab-separated kin (Sierra Chart saves .txt), and Excel workbooks */
const ACCEPTED = [
  '.csv',
  '.tsv',
  '.txt',
  '.xlsx',
  'text/csv',
  'text/plain',
  'text/tab-separated-values',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');
const tradesWord = (n: number) => `${n} ${n === 1 ? 'trade' : 'trades'}`;
const openWord = (n: number) => `${n} open ${n === 1 ? 'trade' : 'trades'}`;
/** what the Import button does, in words: "Import 3 trades and finish 1 open trade" */
const importLabel = (added: number, finished: number) =>
  !finished
    ? `Import ${added ? tradesWord(added) : 'trades'}`
    : added
      ? `Import ${tradesWord(added)} and finish ${openWord(finished)}`
      : `Finish ${openWord(finished)}`;
/** the platforms whose exports import as they come, grouped for the list in the import window */
const PLATFORM_GROUPS = [...new Set(PLATFORMS.map((p) => p.group))].map((group: PlatformGroup) => ({
  group,
  platforms: PLATFORMS.filter((p) => p.group === group),
}));
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

/** the import itself, also the "From a file" side of Log a trade */
export function ImportBody({ onClose }: { onClose: () => void }) {
  const { data, actions } = useJournal();
  const { toast } = useUI();
  const [accountId, setAccountId] = useState(
    data.activeAccountId === 'all' ? data.accounts[0].id : data.activeAccountId,
  );
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  /** an Excel workbook's sheets, when the file is one, and which is being read */
  const [sheets, setSheets] = useState<WorkbookSheet[] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [combinePartials, setCombinePartials] = useState(true);
  const [importLikely, setImportLikely] = useState(false);
  /** whether trades the journal has open, which the file closes, are finished */
  const [finishOpen, setFinishOpen] = useState(true);
  const [choices, setChoices] = useState<Choices>(AUTOMATIC);
  /** the layout whose remembered choices have been looked up */
  const [lookedUp, setLookedUp] = useState('');
  const [restored, setRestored] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const currency = data.settings.currency;

  const options = useMemo(
    () => ({
      accountId,
      accounts: data.accounts,
      setups: data.setups,
      existing: data.trades,
      combinePartials,
      mapping: choices.mapping,
      rowKind: choices.rowKind,
      dateOrder: choices.dateOrder,
      defaultSymbol: choices.defaultSymbol,
    }),
    [accountId, data.accounts, data.setups, data.trades, combinePartials, choices],
  );
  // read as it finishes open trades, which is also how the preview knows which
  // they are; read again without, only when asked to leave them open
  const finishing = useMemo(() => (text ? importTradesFromCsv(text, options) : null), [text, options]);
  const finishable = finishing?.finished ?? [];
  const leaving = useMemo(
    () =>
      text && !finishOpen && finishable.length ? importTradesFromCsv(text, { ...options, finishOpen: false }) : null,
    [text, options, finishOpen, finishable.length],
  );
  const result = leaving ?? finishing;
  const layout = result?.layout ?? null;

  // a layout seen before reads the way it was set up last time
  useEffect(() => {
    if (!layout || layout.signature === lookedUp) return;
    setLookedUp(layout.signature);
    const saved = rememberedChoices(layout.signature);
    setRestored(Boolean(saved));
    if (saved) setChoices(saved);
  }, [layout, lookedUp]);

  /** a new table to read: what was set for the last one no longer applies */
  const startOver = (next: string) => {
    setChoices(AUTOMATIC);
    setLookedUp('');
    setRestored(false);
    setShowColumns(false);
    setImportLikely(false);
    setFinishOpen(true);
    setText(next);
  };

  /** a workbook's sheet to read, unless it holds more than one import takes */
  const openSheet = (book: WorkbookSheet[], index: number) => {
    setSheetIndex(index);
    const csv = sheetToCsv(book[index]);
    const tooLarge = sheetTooLarge(csv);
    setFileError(tooLarge ?? '');
    startOver(tooLarge ? '' : csv);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setFileError('');
    // refused before any of it is read
    const tooLarge = fileTooLarge(file.size);
    if (tooLarge) {
      setSheets(null);
      startOver('');
      setFileError(tooLarge);
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isZip(bytes) && !isOldExcel(bytes)) {
      setSheets(null);
      startOver(new TextDecoder().decode(bytes));
      return;
    }
    try {
      const book = await readWorkbook(bytes);
      setSheets(book);
      openSheet(book, likeliestSheet(book));
    } catch (e) {
      setSheets(null);
      startOver('');
      setFileError(
        e instanceof WorkbookError
          ? e.message
          : 'This workbook could not be read. Open it in Excel, save the sheet as CSV, and import that.',
      );
    }
  };

  const chooseSheet = (index: number) => {
    if (sheets) openSheet(sheets, index);
  };

  const setRole = (index: number, role: Role | '') =>
    setChoices((c) => ({ ...c, mapping: { ...c.mapping, [index]: role } }));
  const noSymbolColumn = Boolean(layout && !layout.columns.some((c) => c.role === 'symbol' || c.role === 'underlying'));
  const used = layout?.columns.filter((c) => c.role).length ?? 0;
  const guessed = layout?.columns.filter((c) => c.guessed).length ?? 0;

  // what the Import button adds: likely duplicates only when asked for, and
  // only the new setups those trades use; and the open trades it finishes
  const likely = result?.likelyDuplicates ?? [];
  const toImport = result ? (importLikely ? [...result.trades, ...likely] : result.trades) : [];
  const finished = result?.finished ?? [];
  const incomplete = [...toImport, ...finished].filter((t) => t.needsReview).length;
  const newSetups = result?.newSetups.filter((s) => [...toImport, ...finished].some((t) => t.setupId === s.id)) ?? [];
  const preview = toImport.slice(0, 6);
  const journalById = useMemo(() => new Map(data.trades.map((t) => [t.id, t])), [data.trades]);

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
              <span className="md:hidden">Tap to choose a CSV or Excel file</span>
              <span className="max-md:hidden">Drop a CSV or Excel file here, or click to choose one</span>
            </>
          )}
        </span>
        <span className="mt-1 text-xs text-faint">
          Works with the exports of the {PLATFORMS.length} platforms listed below, most other brokers&apos; files, whole
          trades or individual fills, and the template above.
        </span>
        <input type="file" accept={ACCEPTED} className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />
      </label>

      {sheets && sheets.length > 1 && (
        <Field label="Sheet" hint={`${sheets.length} in this workbook`}>
          <Select value={sheetIndex} onChange={(e) => chooseSheet(Number(e.target.value))}>
            {sheets.map((sheet, i) => (
              <option key={i} value={i}>
                {sheet.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {(fileError || (sheets && !text.trim())) && (
        <p className="flex items-start gap-1.5 text-xs text-loss">
          <CircleAlert className="mt-px size-3.5 shrink-0" /> {fileError || 'This sheet is empty.'}
        </p>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-app px-4 py-3 text-sm">
            {result.platform && (
              <span className="flex items-center gap-2 text-muted">
                <FileSpreadsheet className="size-4 text-accent" />
                Recognised: {result.platform.name}, {result.platform.file}
              </span>
            )}
            <span className="flex items-center gap-2 text-fg">
              <CircleCheck className="size-4 text-profit" />
              <span className="num font-semibold">{toImport.length}</span> ready to import
            </span>
            {finished.length > 0 && (
              <span className="flex items-center gap-2 text-fg">
                <CheckCheck className="size-4 text-profit" />
                <span className="num font-semibold">{finished.length}</span> open{' '}
                {finished.length === 1 ? 'trade' : 'trades'} finished
              </span>
            )}
            {result.duplicates > 0 && (
              <span className="flex items-center gap-2 text-muted">
                <Info className="size-4 text-accent" />
                <span className="num">{result.duplicates}</span> already in your journal, skipped
              </span>
            )}
            {incomplete > 0 && (
              <span className="flex items-center gap-2 text-warn">
                <TriangleAlert className="size-4" />
                <span className="num">{incomplete}</span> need details before they count
              </span>
            )}
            {result.combined > 0 && (
              <span className="flex items-center gap-2 text-muted">
                <Merge className="size-4 text-accent" />
                <span className="num">{result.combined}</span> partial fills folded into whole positions
              </span>
            )}
            {newSetups.length > 0 && (
              <span className="text-muted">{newSetups.length} new playbook setups will be created</span>
            )}
          </div>

          {likely.length > 0 && (
            <div className="rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
              <p className="flex items-start gap-2 text-fg">
                <CopyCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  <span className="num font-semibold">{likely.length}</span>{' '}
                  {likely.length === 1 ? 'looks like a trade' : 'look like trades'} already in your journal: same
                  account, symbol, side, entry time and size.{' '}
                  {importLikely
                    ? `${likely.length === 1 ? 'It' : 'They'} will be imported as well.`
                    : 'Left out, so nothing is added twice.'}
                </span>
              </p>
              <ul className="mt-2 space-y-0.5 pl-6 text-xs text-muted">
                {likely.slice(0, 4).map((t) => (
                  <li key={t.id} className="num">
                    {t.symbol} {t.side === 'LONG' ? 'long' : 'short'} · {formatShortDate(t.openedAt)}{' '}
                    {formatTime(t.openedAt)} · {t.quantity}
                  </li>
                ))}
                {likely.length > 4 && <li>…and {likely.length - 4} more</li>}
              </ul>
              <label className="mt-2 flex cursor-pointer items-center gap-2 pl-6 text-xs text-muted">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={importLikely}
                  onChange={(e) => setImportLikely(e.target.checked)}
                />
                {likely.length === 1
                  ? 'Import it anyway: it is a different trade'
                  : 'Import them anyway: they are different trades'}
              </label>
            </div>
          )}

          {finishable.length > 0 && (
            <div className="rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
              <p className="flex items-start gap-2 text-fg">
                <CheckCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  This file closes{' '}
                  {finishable.length === 1 ? (
                    'a trade'
                  ) : (
                    <>
                      <span className="num font-semibold">{finishable.length}</span> trades
                    </>
                  )}{' '}
                  your journal has open.{' '}
                  {finishOpen
                    ? `${finishable.length === 1 ? 'It is' : 'They are'} finished with the file's exit: your notes, setup and tags stay.`
                    : `${finishable.length === 1 ? 'It stays' : 'They stay'} open, and the file's closing fills come in as trades of their own.`}
                </span>
              </p>
              <ul className="mt-2 space-y-0.5 pl-6 text-xs text-muted">
                {finishable.slice(0, 4).map((t) => {
                  const was = journalById.get(t.id);
                  const part = was != null && was.quantity > t.quantity + 1e-9;
                  return (
                    <li key={t.id} className="num">
                      {t.symbol} {t.side === 'LONG' ? 'long' : 'short'} · opened {formatShortDate(t.openedAt)}{' '}
                      {formatTime(t.openedAt)} · {part ? `${t.quantity} of ${was.quantity}` : t.quantity}
                      {t.closedAt ? ` · closed ${formatShortDate(t.closedAt)} ${formatTime(t.closedAt)}` : ''}
                      {t.exitPrice != null ? ` at ${formatPrice(t.exitPrice)}` : ''}
                      {!t.needsReview && (
                        <>
                          {' · '}
                          <PnlValue value={netPnl(t)} currency={currency} />
                        </>
                      )}
                      {part && ', the rest stays open'}
                    </li>
                  );
                })}
                {finishable.length > 4 && <li>…and {finishable.length - 4} more</li>}
              </ul>
              <label className="mt-2 flex cursor-pointer items-center gap-2 pl-6 text-xs text-muted">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={!finishOpen}
                  onChange={(e) => setFinishOpen(!e.target.checked)}
                />
                {finishable.length === 1 ? 'Leave it open' : 'Leave them open'}, and import the closing fills as trades
                of their own
              </label>
            </div>
          )}

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
                {guessed > 0 ? `, ${guessed} guessed from ${guessed === 1 ? 'its name' : 'their names'}` : ''}
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
                      {column.guessed && <div className="text-[11px] text-warn">guessed from its name</div>}
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
              {toImport.length > preview.length && (
                <div className="border-t border-line px-3 py-2 text-xs text-faint">
                  …and {toImport.length - preview.length} more rows.
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
          Which file to export from your platform
        </summary>
        <div className="mt-2 space-y-3 leading-relaxed">
          <p>
            These platforms&apos; exports import as they come, and the preview names the platform when it recognises the
            file. Any other CSV with a symbol column works too: check the columns in the preview.
          </p>
          {PLATFORM_GROUPS.map(({ group, platforms }) => (
            <div key={group}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">{group}</h3>
              <ul className="mt-1 space-y-1">
                {platforms.map((p) => (
                  <li key={p.name}>
                    <span className="text-fg">{p.name}</span>: {p.how}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none text-sm text-muted hover:text-fg">
          Which columns are understood
        </summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>
            CSV files and Excel workbooks (.xlsx) are both read. In a workbook, the sheet that looks most like a list of
            trades is used, and you can choose another. An old .xls file needs saving as .xlsx or CSV first.
          </p>
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
            <span className="num">Date/Time</span>, separate date and time columns — and several fee columns add up; a
            commission per contract is multiplied by the size. A name it doesn&apos;t know as a whole is read by its
            words when it knows every one of them, so <span className="num">Start Price</span> is the entry price and{' '}
            <span className="num">Lots Traded</span> the quantity; the preview says which columns it read that way.
            Title lines above the table and total lines below it are skipped. Anything read wrongly can be changed under
            Columns. Separate several tags with a | character.
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
          <p>
            Importing the same trades again adds nothing, so a daily export that overlaps the last one is safe. Where
            the broker numbers its trades or fills, those numbers decide. Otherwise a trade with the same account,
            symbol, side, entry time and size as one already in your journal is left out, and the preview lists it in
            case it really is a second trade.
          </p>
          <p>
            A position that an earlier export left open is finished by the export that closes it: the trade in your
            journal gets the exit, and your notes, setup and tags stay. The preview lists those trades, with a way to
            leave them open.
          </p>
        </div>
      </details>

      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!toImport.length && !finished.length}
          onClick={() => {
            if (!toImport.length && !finished.length) return;
            if (layout) rememberChoices(layout.signature, choices);
            actions.importTrades(toImport, newSetups, finished);
            const done = !finished.length
              ? `Imported ${tradesWord(toImport.length)}`
              : toImport.length
                ? `Imported ${tradesWord(toImport.length)}, finished ${openWord(finished.length)}`
                : `Finished ${openWord(finished.length)}`;
            toast(incomplete > 0 ? `${done} — ${incomplete} need details` : done, incomplete > 0 ? 'info' : 'success');
            onClose();
          }}
        >
          {importLabel(toImport.length, finished.length)}
        </Button>
      </div>
    </div>
  );
}
