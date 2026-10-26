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
  // folder names, as they are on disk
  'data/backups',
  'data/screenshots',
  'backups',
  'screenshots',
  // app and platform names
  'Google',
  'Drive',
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
