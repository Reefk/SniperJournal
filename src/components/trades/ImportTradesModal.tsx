'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CopyCheck,
  FileSpreadsheet,
  Info,
  Merge,
  Receipt,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import {
  PLATFORMS,
  WorkbookError,
  csvTemplate,
  describeGaps,
  fileTooLarge,
  groupName,
  importTradesFromCsv,
  isOldExcel,
  isZip,
  likeliestSheet,
  noFeesNotice,
  quoted,
  readWorkbook,
  roleLabels,
  say,
  sheetToCsv,
  sheetTooLarge,
  zeroFeesNotice,
  type DateOrder,
  type FeeRate,
  type PlatformGroup,
  type Role,
  type WorkbookSheet,
} from '@/lib/csv';
import { formatMoney, formatPrice, formatShortDate, formatTime } from '@/lib/format';
import { decimalMark, tr } from '@/lib/i18n';
import { isClosed, netPnl } from '@/lib/trade-math';
import { cn, downloadFile, toNumberOrNull } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { PnlValue, SideBadge, StatusBadge } from '@/components/ui/StatusBadge';
import { rich } from '@/components/ui/Rich';

export function ImportTradesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="xl" title={tr('impw.title')} description={tr('impw.description')}>
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
/** what the Import button does, in words: "Import 3 trades and finish 1 open trade" */
const importLabel = (added: number, finished: number) =>
  !finished
    ? added
      ? tr('impw.button.importN', { count: added })
      : tr('impw.button.import')
    : added
      ? tr('impw.button.importAndFinish', {
          count: added,
          open: tr('impw.button.open', { count: finished }),
        })
      : tr('impw.button.finish', { count: finished });
/** what the Import button did: "Imported 3 trades, finished 1 open trade" */
const doneLabel = (added: number, finished: number) =>
  !finished
    ? tr('impw.done.imported', { count: added })
    : added
      ? tr('impw.done.importedAndFinished', { count: added, open: tr('impw.done.open', { count: finished }) })
      : tr('impw.done.finished', { count: finished });
/** a tag's text in a sentence, drawn in a span: a count, or a word to stand out */
const span = (className: string, chunk: string) => <span className={className}>{chunk}</span>;
const sideWord = (side: 'LONG' | 'SHORT') => tr(`side.${side}`).toLowerCase();
/** the column names in "Which columns are understood", as brokers write them */
const NAME_EXAMPLES = ['Qty', 'Filled', 'Market pos.', 'Comm/Fee', 'Net P&L (USD)', 'Date/Time'];
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

/**
 * a fee as typed: to add to a file with none of its own, or to charge in
 * place of the file's; 'none' leaves the file's fees, or none, as they are
 */
interface FeeChoice {
  per: 'none' | FeeRate['per'];
  amount: string;
}
const NO_FEE: FeeChoice = { per: 'none', amount: '' };
/** the fee typed, when it is one to charge: an amount above 0 */
function rateOf(fee: FeeChoice): FeeRate | undefined {
  if (fee.per === 'none') return undefined;
  const amount = toNumberOrNull(fee.amount);
  return amount != null && amount > 0 ? { per: fee.per, amount } : undefined;
}

/**
 * The fee is remembered per account, on this device only, so the next export
 * into the same account gets the same fee without typing it again.
 */
const FEE_KEY = 'sniper-journal:import-fee:';
function rememberedFee(accountId: string): FeeChoice {
  try {
    const raw = localStorage.getItem(FEE_KEY + accountId);
    const saved = raw ? (JSON.parse(raw) as Partial<FeeChoice>) : null;
    return saved && (saved.per === 'trade' || saved.per === 'contract') && typeof saved.amount === 'string'
      ? { per: saved.per, amount: saved.amount }
      : NO_FEE;
  } catch {
    return NO_FEE;
  }
}
function rememberFee(accountId: string, fee: FeeChoice) {
  try {
    if (!rateOf(fee)) localStorage.removeItem(FEE_KEY + accountId);
    else localStorage.setItem(FEE_KEY + accountId, JSON.stringify(fee));
  } catch {
    /* storage unavailable: the fee simply is not remembered */
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
  /** for a file with no fees of its own; kept from file to file, and per account */
  const [fee, setFee] = useState(() => rememberedFee(accountId));
  /** for a file with fees of its own, charged in their place; this file only */
  const [replace, setReplace] = useState(NO_FEE);
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
      addFee: rateOf(fee),
      replaceFees: rateOf(replace),
    }),
    [accountId, data.accounts, data.setups, data.trades, combinePartials, choices, fee, replace],
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
    setReplace(NO_FEE);
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
      setFileError(e instanceof WorkbookError ? e.message : tr('impw.unreadable'));
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

  // the fee box: a fee to add to a file with no fees of its own, said there in
  // place of the notice; or for a file with fees, your own in their place
  const feeBox = toImport.length + likely.length + finished.length > 0;
  const missing = Boolean(result?.feesMissing);
  const notices = feeBox
    ? (result?.notices ?? []).filter((n) => n !== noFeesNotice() && n !== zeroFeesNotice())
    : result?.notices;
  const choice = missing ? fee : replace;
  const setChoice = missing ? setFee : setReplace;
  const feeTyped = choice.per !== 'none' && choice.amount.trim() !== '';
  const feeError = feeTyped && !rateOf(choice) ? tr('impw.fee.aboveZero') : undefined;
  const charged = [...toImport, ...finished];
  const feesTotal = charged.reduce((sum, t) => sum + t.fees, 0);
  const netTotal = charged.filter((t) => isClosed(t) && !t.needsReview).reduce((sum, t) => sum + netPnl(t), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto]">
        <Field label={tr('impw.account')} hint={tr('impw.account.hint')}>
          <Select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setFee(rememberedFee(e.target.value));
            }}
          >
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={() => downloadFile('sniper-journal-template.csv', csvTemplate(), 'text/csv')}>
          <FileSpreadsheet className="size-4" /> {tr('impw.template')}
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
              <span className="md:hidden">{tr('impw.drop.tap')}</span>
              <span className="max-md:hidden">{tr('impw.drop.click')}</span>
            </>
          )}
        </span>
        <span className="mt-1 text-xs text-faint">{tr('impw.drop.works', { count: PLATFORMS.length })}</span>
        <input type="file" accept={ACCEPTED} className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />
      </label>

      {sheets && sheets.length > 1 && (
        <Field label={tr('impw.sheet')} hint={tr('impw.sheet.hint', { count: sheets.length })}>
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
          <CircleAlert className="mt-px size-3.5 shrink-0" /> {fileError || tr('impw.sheet.empty')}
        </p>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-app px-4 py-3 text-sm">
            {result.platform && (
              <span className="flex items-center gap-2 text-muted">
                <FileSpreadsheet className="size-4 text-accent" />
                {tr('impw.recognised', { name: result.platform.name, file: result.platform.file })}
              </span>
            )}
            <span className="flex items-center gap-2 text-fg">
              <CircleCheck className="size-4 text-profit" />
              {rich(tr('impw.ready', { count: toImport.length }), { num: (chunk) => span('num font-semibold', chunk) })}
            </span>
            {finished.length > 0 && (
              <span className="flex items-center gap-2 text-fg">
                <CheckCheck className="size-4 text-profit" />
                {rich(tr('impw.finished', { count: finished.length }), {
                  num: (chunk) => span('num font-semibold', chunk),
                })}
              </span>
            )}
            {result.duplicates > 0 && (
              <span className="flex items-center gap-2 text-muted">
                <Info className="size-4 text-accent" />
                {rich(tr('impw.duplicates', { count: result.duplicates }), { num: (chunk) => span('num', chunk) })}
              </span>
            )}
            {incomplete > 0 && (
              <span className="flex items-center gap-2 text-warn">
                <TriangleAlert className="size-4" />
                {rich(tr('impw.incomplete', { count: incomplete }), { num: (chunk) => span('num', chunk) })}
              </span>
            )}
            {result.combined > 0 && (
              <span className="flex items-center gap-2 text-muted">
                <Merge className="size-4 text-accent" />
                {rich(tr('impw.combined', { count: result.combined }), { num: (chunk) => span('num', chunk) })}
              </span>
            )}
            {newSetups.length > 0 && (
              <span className="text-muted">{tr('impw.newSetups', { count: newSetups.length })}</span>
            )}
          </div>

          {likely.length > 0 && (
            <div className="rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
              <p className="flex items-start gap-2 text-fg">
                <CopyCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  {rich(tr('impw.likely', { count: likely.length }), {
                    num: (chunk) => span('num font-semibold', chunk),
                  })}{' '}
                  {importLikely
                    ? tr(likely.length === 1 ? 'impw.likely.imported.one' : 'impw.likely.imported.many')
                    : tr(likely.length === 1 ? 'impw.likely.leftOut.one' : 'impw.likely.leftOut.many')}
                </span>
              </p>
              <ul className="mt-2 space-y-0.5 pl-6 text-xs text-muted">
                {likely.slice(0, 4).map((t) => (
                  <li key={t.id} className="num">
                    {t.symbol} {sideWord(t.side)} · {formatShortDate(t.openedAt)} {formatTime(t.openedAt)} ·{' '}
                    {t.quantity}
                  </li>
                ))}
                {likely.length > 4 && <li>{tr('impw.more', { count: likely.length - 4 })}</li>}
              </ul>
              <label className="mt-2 flex cursor-pointer items-center gap-2 pl-6 text-xs text-muted">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={importLikely}
                  onChange={(e) => setImportLikely(e.target.checked)}
                />
                {tr(likely.length === 1 ? 'impw.likely.anyway.one' : 'impw.likely.anyway.many')}
              </label>
            </div>
          )}

          {finishable.length > 0 && (
            <div className="rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
              <p className="flex items-start gap-2 text-fg">
                <CheckCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  {finishable.length === 1
                    ? tr('impw.closes.one')
                    : rich(tr('impw.closes', { count: finishable.length }), {
                        num: (chunk) => span('num font-semibold', chunk),
                      })}{' '}
                  {tr(
                    finishOpen
                      ? finishable.length === 1
                        ? 'impw.closes.finish.one'
                        : 'impw.closes.finish.many'
                      : finishable.length === 1
                        ? 'impw.closes.stay.one'
                        : 'impw.closes.stay.many',
                  )}
                </span>
              </p>
              <ul className="mt-2 space-y-0.5 pl-6 text-xs text-muted">
                {finishable.slice(0, 4).map((t) => {
                  const was = journalById.get(t.id);
                  const part = was != null && was.quantity > t.quantity + 1e-9;
                  return (
                    <li key={t.id} className="num">
                      {t.symbol} {sideWord(t.side)} ·{' '}
                      {tr('impw.closes.opened', { when: `${formatShortDate(t.openedAt)} ${formatTime(t.openedAt)}` })} ·{' '}
                      {part ? tr('impw.closes.part', { part: t.quantity, whole: was.quantity }) : t.quantity}
                      {t.closedAt
                        ? ` · ${tr('impw.closes.closed', { when: `${formatShortDate(t.closedAt)} ${formatTime(t.closedAt)}` })}`
                        : ''}
                      {t.exitPrice != null ? ` ${tr('impw.closes.at', { price: formatPrice(t.exitPrice) })}` : ''}
                      {!t.needsReview && (
                        <>
                          {' · '}
                          <PnlValue value={netPnl(t)} currency={currency} />
                        </>
                      )}
                      {part && tr('impw.closes.rest')}
                    </li>
                  );
                })}
                {finishable.length > 4 && <li>{tr('impw.more', { count: finishable.length - 4 })}</li>}
              </ul>
              <label className="mt-2 flex cursor-pointer items-center gap-2 pl-6 text-xs text-muted">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={!finishOpen}
                  onChange={(e) => setFinishOpen(!e.target.checked)}
                />
                {tr(finishable.length === 1 ? 'impw.closes.leave.one' : 'impw.closes.leave.many')}
              </label>
            </div>
          )}

          {feeBox && (
            <div className="rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
              <p className="flex items-start gap-2 text-fg">
                <Receipt className="mt-0.5 size-4 shrink-0 text-accent" />
                {missing ? (
                  <span>{tr(result.feesMissing === 'zero' ? 'impw.fee.zero' : 'impw.fee.none')}</span>
                ) : (
                  <span>{tr('impw.fee.fromFile')}</span>
                )}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 pl-6 md:grid-cols-2">
                <Field label={tr(missing ? 'impw.fee.toAdd' : 'impw.fee.fees')}>
                  <Select
                    value={choice.per}
                    onChange={(e) => setChoice((f) => ({ ...f, per: e.target.value as FeeChoice['per'] }))}
                  >
                    <option value="none">{tr(missing ? 'impw.fee.opt.none' : 'impw.fee.opt.fromFile')}</option>
                    <option value="trade">{tr(missing ? 'impw.fee.opt.trade' : 'impw.fee.opt.ownTrade')}</option>
                    <option value="contract">
                      {tr(missing ? 'impw.fee.opt.contract' : 'impw.fee.opt.ownContract')}
                    </option>
                  </Select>
                </Field>
                {choice.per !== 'none' && (
                  <Field
                    label={tr('impw.fee.amount')}
                    hint={tr(choice.per === 'contract' ? 'impw.fee.hint.contract' : 'impw.fee.hint.trade')}
                    error={feeError}
                  >
                    <Input
                      inputMode="decimal"
                      className="num"
                      value={choice.amount}
                      invalid={Boolean(feeError)}
                      onChange={(e) => setChoice((f) => ({ ...f, amount: e.target.value }))}
                      placeholder={tr('goals.example', { n: decimalMark(choice.per === 'contract' ? '0.95' : '1.90') })}
                    />
                  </Field>
                )}
              </div>
              <p className="mt-2 pl-6 text-xs leading-relaxed text-muted">
                {rich(tr('impw.fee.totals'), {
                  money: () => <span className="num text-fg">{formatMoney(feesTotal, currency)}</span>,
                  pnl: () => <PnlValue value={netTotal} currency={currency} />,
                })}
                {rateOf(choice) && finished.length > 0 && tr('impw.fee.whole')}
              </p>
            </div>
          )}

          {notices && notices.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-accent/25 bg-accent/5 px-4 py-2.5 text-xs leading-relaxed text-muted">
              {notices.map((notice, i) => (
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
                <Field label={tr('imp.label.eachRowIs')}>
                  <Select
                    value={layout.rowKind === 'fills' ? 'fills' : 'trades'}
                    onChange={(e) => setChoices((c) => ({ ...c, rowKind: e.target.value as 'trades' | 'fills' }))}
                  >
                    <option value="trades">{tr('impw.rowKind.trades')}</option>
                    <option value="fills">{tr('impw.rowKind.fills')}</option>
                  </Select>
                </Field>
              )}
              {(layout.ambiguousDates || choices.dateOrder) && (
                <Field label={tr('impw.dates')}>
                  <Select
                    value={layout.dateOrder ?? 'mdy'}
                    onChange={(e) => setChoices((c) => ({ ...c, dateOrder: e.target.value as DateOrder }))}
                  >
                    <option value="mdy">{tr('impw.dates.mdy')}</option>
                    <option value="dmy">{tr('impw.dates.dmy')}</option>
                  </Select>
                </Field>
              )}
              {noSymbolColumn && (
                <Field label={tr('impw.symbolForAll')} hint={tr('impw.symbolForAll.hint')}>
                  <Input
                    value={choices.defaultSymbol}
                    onChange={(e) => setChoices((c) => ({ ...c, defaultSymbol: e.target.value }))}
                    placeholder={tr('goals.example', { n: 'ES' })}
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
                {tr('impw.columns.used', { columns: tr('imp.label.columns'), used, total: layout.columns.length })}
                {guessed > 0 ? tr('impw.columns.guessed', { count: guessed }) : ''}
                {restored ? tr('impw.columns.restored') : ''}
              </summary>
              <div className="max-h-72 space-y-2 overflow-y-auto border-t border-line px-4 py-3">
                <p className="text-xs leading-relaxed text-faint">{tr('impw.columns.explain')}</p>
                {layout.columns.map((column) => (
                  <div key={column.index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-fg">
                        {column.header || tr('impw.columns.unnamed', { n: column.index + 1 })}
                      </div>
                      <div className="num truncate text-[11px] text-faint">{column.sample || '—'}</div>
                      {column.guessed && <div className="text-[11px] text-warn">{tr('impw.columns.guessedOne')}</div>}
                    </div>
                    <Select
                      aria-label={tr('impw.columns.what', {
                        name: quoted(column.header || tr('impw.columns.unnamedLower', { n: column.index + 1 })),
                      })}
                      value={column.role}
                      onChange={(e) => setRole(column.index, e.target.value as Role | '')}
                    >
                      <option value="">{tr('impw.columns.notUsed')}</option>
                      {roleLabels().map(([role, label]) => (
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
                    {tr('impw.columns.automatic')}
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
                <span className="text-fg">{tr('impw.combine')}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{tr('impw.combine.explain')}</span>
              </span>
            </label>
          )}

          {result.pairedFills && result.trades.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/5 px-4 py-2.5 text-xs leading-relaxed text-muted">
              <Info className="mt-px size-3.5 shrink-0 text-accent" />
              <span>{tr('impw.paired')}</span>
            </p>
          )}

          {preview.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-line max-md:overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm md:whitespace-normal">
                <thead className="border-b border-line bg-app/50 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{tr('impw.col.date')}</th>
                    <th className="px-3 py-2 text-left font-medium">{tr('form.symbol')}</th>
                    <th className="px-3 py-2 text-left font-medium">{tr('form.side')}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr('list.col.qty')}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr('list.col.entry')}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr('list.col.exit')}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr('list.col.pnl')}</th>
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
                          <StatusBadge tone="warn">{tr('impw.noDate')}</StatusBadge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold text-fg">
                        {t.symbol}
                        {(t.fillCount ?? 1) > 1 && (
                          <span className="ml-1.5 text-[11px] font-normal text-accent">
                            {tr('list.fills', { count: t.fillCount ?? 1 })}
                          </span>
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
                  {tr('impw.moreRows', { count: toImport.length - preview.length })}
                </div>
              )}
            </div>
          )}

          {result.ignored.length > 0 && (
            <p className="text-xs text-faint">
              {rich(tr('impw.ignored'), {
                num: () => <span className="num">{result.ignored.join(tr('format.comma'))}</span>,
              })}
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
                <p className="text-xs text-muted">{tr('impw.moreErrors', { count: result.errors.length - 30 })}</p>
              )}
            </div>
          )}
        </>
      )}

      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none text-sm text-muted hover:text-fg">
          {tr('impw.help.platforms')}
        </summary>
        <div className="mt-2 space-y-3 leading-relaxed">
          <p>{tr('impw.help.platformsIntro')}</p>
          {PLATFORM_GROUPS.map(({ group, platforms }) => (
            <div key={group}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">{groupName(group)}</h3>
              <ul className="mt-1 space-y-1">
                {platforms.map((p) => (
                  <li key={p.name}>
                    <span className="text-fg">{p.name}</span>: {say(p.how)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none text-sm text-muted hover:text-fg">
          {tr('impw.help.columns')}
        </summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>{tr('impw.help.files')}</p>
          <p>{rich(tr('impw.help.symbol'), { fg: (chunk) => span('text-fg', chunk) })}</p>
          <p>{rich(tr('impw.help.rows'), { fg: (chunk) => span('text-fg', chunk) })}</p>
          <p>
            {rich(tr('impw.help.names', { columns: tr('imp.label.columns') }), {
              names: () =>
                NAME_EXAMPLES.map((name, i) => (
                  <Fragment key={name}>
                    {i > 0 && tr('format.comma')}
                    <span className="num">{name}</span>
                  </Fragment>
                )),
              start: () => <span className="num">Start Price</span>,
              lots: () => <span className="num">Lots Traded</span>,
            })}
          </p>
          <p>{tr('impw.help.points', { first: 'ESH6', second: 'MNQ 03-26' })}</p>
          <p>{rich(tr('impw.help.needs'), { warn: (chunk) => span('text-warn', chunk) })}</p>
          <p>{tr('impw.help.again')}</p>
          <p>{tr('impw.help.finish')}</p>
        </div>
      </details>

      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          {tr('common.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={!toImport.length && !finished.length}
          onClick={() => {
            if (!toImport.length && !finished.length) return;
            if (layout) rememberChoices(layout.signature, choices);
            // only a file with no fees of its own changes the one remembered
            if (feeBox && missing) rememberFee(accountId, fee);
            actions.importTrades(toImport, newSetups, finished);
            const done = doneLabel(toImport.length, finished.length);
            toast(
              incomplete > 0 ? tr('impw.done.needDetails', { done, count: incomplete }) : done,
              incomplete > 0 ? 'info' : 'success',
            );
            onClose();
          }}
        >
          {importLabel(toImport.length, finished.length)}
        </Button>
      </div>
    </div>
  );
}
