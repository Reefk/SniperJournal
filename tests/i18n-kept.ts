/**
 * For the translation tests: what may stay in English (Latin letters) in
 * every language, and text with it taken out.
 */

/** words that stay as they are in every language: names, units and codes */
export const KEPT = [
  'Sniper Journal',
  'Sniper Score',
  // what traders call these in every language
  'FOMO',
  // futures symbols
  'ES',
  'NQ',
  'MNQ',
  'MES',
  'INSTALLER.bat',
  // folder and file names, as they are on disk
  'data/backups',
  'data/screenshots',
  'data/journal.json',
  'journal.json',
  'backups',
  'screenshots',
  // app and platform names
  'Google',
  'Drive',
  'Chrome',
  'OneDrive',
  'Windows',
  'Android',
  'Microsoft Store',
  'Excel',
  'Interactive Brokers',
  'TradingView',
  // file kinds
  'xlsx',
  'xls',
  'zip',
  'ID',
  'Ctrl',
  'Enter',
  'Esc',
  'Tab',
  'Shift',
  'P&L',
  'PnL',
  'CFD',
  'CSV',
  'XLSX',
  'JSON',
  'PNG',
  'JPEG',
  'WebP',
  'GIF',
  'MFE',
  'MAE',
  'SQN',
  'PC',
  'KB',
  'MB',
  'GB',
  'N',
  'R',
];

/** what the Support page puts in as it is typed: the commands, the address and broker column headings */
export const SUPPORT_TYPED = [
  'npm start',
  'npm run dev',
  'http://localhost:3000',
  'qty',
  'ticker',
  'commission',
  'realized pnl',
];

/** English words that are not also Spanish, to find what was left untranslated in Spanish ("importó" is not "import") */
export const ENGLISH =
  /(?<!\p{L})(the|and|of|your|trades?|with|for|is|are|you|this|that|from|days?|wins?|loss(es)?|rate|profit|average|closed|show|view|log|balance|settings|delete|edit|add|yet|per|green|red|best|worst|largest|streak|current|recent|equity|curve|rated|backups?|images?|account|tags?|mistakes?|limits?|goals?|cancel|confirm|close|save|import|export|merge|search|filters?|selected|shown|open|needs|details|page|next|previous|net|results|consistency|risk|gross|commissions?|expectancy|recovery|months?|week|symbols?|unknown|longest|hold|times?|print|reports?|summar(y|ies)|cost|none|clean|greyed|dotted|groups?|under|since|made|less|about|each|rows?|counts?|range|starting|peak|share|monthly|printable|have|two|all)(?!\p{L})/iu;

/** a translation's text with the names, units and codes that stay in English taken out */
export function withoutKept(text: string): string {
  let out = text.replace(/\{\w+\}/g, ' ').replace(/<\/?\w+>/g, ' ');
  for (const word of [...KEPT].sort((a, b) => b.length - a.length)) {
    out = out.replace(
      new RegExp(`(^|[^A-Za-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^A-Za-z]|$)`, 'g'),
      '$1 ',
    );
  }
  return out;
}
