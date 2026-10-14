import { planColumns, type ColumnPlan, type Role } from './columns';
import { findTable, parseCsv, type Table } from './table';
import { dateOrderOf, parseMoney, type DateOrder } from './values';

/**
 * The first stage of an import (see importTradesFromCsv in lib/csv.ts): where
 * the table is in the file, what each column is, which kind of rows it holds
 * and the one date order for all of it. Nothing is read into a trade yet.
 */

/** how the rows of a file are read: whole trades, paired buy/sell fills, or one fill each */
export type RowKind = 'trades' | 'paired' | 'fills';

export interface ImportLayout {
  rowKind: RowKind;
  /** the columns allow reading each row as one fill */
  canBeFills: boolean;
  /** 1-based line of the header in the file (blank lines not counted) */
  headerLine: number;
  /** every column, what it is read as, and a value from it to recognise it by */
  columns: Array<ColumnPlan['columns'][number] & { sample: string }>;
  dateOrder?: DateOrder;
  /** dates like 03/04/2026 appear and nothing in the file shows which order they are in */
  ambiguousDates: boolean;
  /** identifies this layout of columns, so a mapping chosen for it can be remembered */
  signature: string;
}

/** what was chosen in the import preview about how to read the file */
export interface LayoutChoices {
  /** column index -> role, as chosen in the import preview */
  mapping?: Record<number, Role | ''>;
  /** read every row as a whole trade, or as one fill; worked out when not given */
  rowKind?: 'trades' | 'fills';
  /** day-month or month-day for dates like 03/04/2026; worked out when not given */
  dateOrder?: DateOrder;
  /** the symbol for every row of a file that has no symbol column (TradingView's list of trades) */
  defaultSymbol?: string;
}

/** a file as it is to be read */
export interface Sheet {
  table: Table;
  plan: ColumnPlan;
  rowKind: RowKind;
  /** each row pairs a buy fill with a sell fill instead of naming a side (Tradovate) */
  paired: boolean;
  /** day-month or month-day, for every date in the file */
  order: DateOrder | undefined;
  layout: ImportLayout;
  /** the roles some column is read as */
  recognised: Role[];
  /** the named columns nothing reads */
  ignored: string[];
  /** the symbol for every row, when the file has no symbol column; '' when none was typed */
  fallbackSymbol: string;
  has(role: Role): boolean;
  /** the column read as this role, the first when several add up */
  at(role: Role): number | undefined;
  /** a cell's text, trimmed; '' when no column is read as this role */
  cell(row: string[], role: Role): string;
}

/** The file's layout, or null when it has no data rows. */
export function detectLayout(text: string, choices: LayoutChoices): Sheet | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const table = findTable(rows);
  if (!table.data.length) return null;

  const plan = planColumns(table.header, table.data.slice(0, 50), choices.mapping);
  const has = (role: Role) => plan.roles.has(role);
  const at = (role: Role) => plan.roles.get(role)?.[0];
  const cell = (row: string[], role: Role): string => {
    const i = at(role);
    return i == null ? '' : (row[i] ?? '').trim();
  };

  const recognised = [...plan.roles.keys()];
  const ignored = plan.columns.filter((c) => !c.role && c.header).map((c) => c.header);

  // ---- which rows are which ------------------------------------------------
  const paired = has('buy_price') && has('sell_price');
  const timed = has('time') || has('date') || has('opened_at') || has('opened_date');
  const signedQuantities = has('quantity') && !has('side') && table.data.some((r) => (parseMoney(cell(r, 'quantity')) ?? 0) < 0);
  const canBeFills = !paired && (has('price') || has('entry_price')) && (has('side') || signedQuantities) && has('quantity') && timed;
  const looksLikeFills =
    canBeFills &&
    !has('exit_price') &&
    !has('closed_at') &&
    !has('closed_date') &&
    (has('price') || has('trade_no') || has('effect') || has('status') || signedQuantities);
  const rowKind: RowKind = paired
    ? 'paired'
    : choices.rowKind === 'fills' && canBeFills
      ? 'fills'
      : choices.rowKind === 'trades'
        ? 'trades'
        : looksLikeFills
          ? 'fills'
          : 'trades';

  // ---- one date order for the whole file, from every date in it -------------
  const dateRoles: Role[] = ['opened_at', 'opened_date', 'closed_at', 'closed_date', 'time', 'date', 'bought_at', 'sold_at'];
  const detected = dateOrderOf(table.data.flatMap((row) => dateRoles.map((r) => cell(row, r))));
  const order = choices.dateOrder ?? detected.order;

  const layout: ImportLayout = {
    rowKind,
    canBeFills,
    headerLine: table.preamble + 1,
    columns: plan.columns.map((c) => ({
      ...c,
      sample:
        table.data
          .slice(0, 20)
          .map((r) => (r[c.index] ?? '').trim())
          .find(Boolean) ?? '',
    })),
    dateOrder: order,
    ambiguousDates: detected.ambiguous,
    signature: table.header.map((h) => h.trim().toLowerCase()).join('|'),
  };

  return {
    table,
    plan,
    rowKind,
    paired,
    order,
    layout,
    recognised,
    ignored,
    fallbackSymbol: (choices.defaultSymbol ?? '').trim().toUpperCase(),
    has,
    at,
    cell,
  };
}

/** Why no row can be read, when no column holds the symbol and none was typed; null otherwise. */
export function missingSymbol(sheet: Sheet): string | null {
  if (sheet.has('symbol') || sheet.has('underlying') || sheet.fallbackSymbol) return null;
  return `No symbol column found. The columns in this file are: ${sheet.table.header.join(', ')}. Choose which column holds the symbol under "Columns" below, or type the symbol for every row.`;
}
