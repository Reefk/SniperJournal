import { describe, expect, it } from 'vitest';
import { parseBackup } from '@/lib/backup';
import { netPnl } from '@/lib/trade-math';
import { normalize } from '@/store/JournalProvider';
import { cleanResources, cleanSettings, cleanSetups, cleanTrades, safeLink } from '@/store/sanitize';
import type { JournalData } from '@/lib/types';
import { trade } from './helpers';

const base = { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null } as const;

function journal(overrides: Partial<JournalData> = {}): JournalData {
  return {
    version: 1,
    updatedAt: '2026-03-02T12:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: { ...base },
    accounts: [{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades: [trade({ id: 'a' }), trade({ id: 'b', tags: ['x'], review: { discipline: 4 } })],
    setups: [{ id: 's1', name: 'ORB', rules: ['wait'], color: '#34d399' }],
    resources: [{ id: 'r1', title: 'TV', url: 'https://tradingview.com', category: 'Charting', createdAt: '' }],
    ...overrides,
  };
}

describe('normalize: loading a journal', () => {
  it('a well-formed journal comes out unchanged', () => {
    const j = journal();
    expect(JSON.parse(JSON.stringify(normalize(j)))).toEqual(JSON.parse(JSON.stringify(j)));
  });

  it('missing, empty or non-object input gives a fresh journal', () => {
    for (const input of [null, undefined, 'text', 42, [], {}]) {
      const j = normalize(input);
      expect(j.version).toBe(1);
      expect(j.trades).toEqual([]);
      expect(j.accounts).toHaveLength(1);
    }
  });

  it('an older journal without newer fields still loads, with defaults filled in', () => {
    const old = {
      version: 1,
      accounts: [{ id: 'acc1', name: 'Main', startingBalance: 0 }],
      activeAccountId: 'acc1',
      trades: [{ id: 't', accountId: 'acc1', symbol: 'AAPL', side: 'LONG', openedAt: '2026-01-02T10:00', quantity: 1, entryPrice: 1 }],
      settings: { currency: 'EUR' },
    };
    const j = normalize(old);
    expect(j.trades[0].tags).toEqual([]);
    expect(j.trades[0].fees).toBe(0);
    expect(j.settings).toEqual({ ...base, currency: 'EUR' });
    expect(j.setups).toEqual([]);
    expect(j.resources).toEqual([]);
  });

  it('values of the wrong type are replaced instead of crashing a screen', () => {
    const j = normalize(
      journal({
        settings: { currency: 'US', theme: 'neon' as never, timezone: 'Mars/Base', maxDailyLoss: 'lots' as never, maxTradesPerDay: null },
        trades: [{ ...trade({ id: 'x' }), tags: 'oops' as never, symbol: 42 as never }, null as never, 'junk' as never],
      }),
    );
    expect(j.settings.currency).toBe('USD');
    expect(j.settings.theme).toBe('dark');
    expect(j.settings.timezone).toBe('local');
    expect(j.settings.maxDailyLoss).toBeNull();
    expect(j.trades).toHaveLength(1);
    expect(j.trades[0].tags).toEqual([]);
    expect(j.trades[0].symbol).toBe('');
  });

  it('an active account that no longer exists falls back to the first account', () => {
    expect(normalize(journal({ activeAccountId: 'gone' })).activeAccountId).toBe('acc1');
    expect(normalize(journal({ activeAccountId: 'all' })).activeAccountId).toBe('all');
  });

  it('duplicate trade ids are made unique, so editing or deleting one trade can never touch another', () => {
    const j = normalize(journal({ trades: [trade({ id: 'dup', symbol: 'A' }), trade({ id: 'dup', symbol: 'B' }), trade({ id: 'u' })] }));
    expect(j.trades).toHaveLength(3);
    expect(new Set(j.trades.map((t) => t.id)).size).toBe(3);
    expect(j.trades[0].id).toBe('dup'); // the first keeps its id
    expect(j.trades.map((t) => t.symbol)).toEqual(['A', 'B', 'TEST']);
  });

  it('duplicate account ids keep the first account; their trades stay attached to it', () => {
    const j = normalize(
      journal({
        accounts: [
          { id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' },
          { id: 'acc1', name: 'Copy', startingBalance: 5, createdAt: '' },
        ],
      }),
    );
    expect(j.accounts).toEqual([{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }]);
  });
});

describe('sanitize: individual rules', () => {
  it('only http and https links survive', () => {
    expect(safeLink('https://example.com/x?y=1')).toBe('https://example.com/x?y=1');
    expect(safeLink('http://localhost:3000')).toBe('http://localhost:3000');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'not a url', 42, null]) {
      expect(safeLink(bad)).toBeUndefined();
    }
    expect(cleanResources([{ id: 'r', url: 'javascript:alert(1)' }])[0].url).toBeUndefined();
  });

  it('setup colours must be plain hex colours', () => {
    expect(cleanSetups([{ id: 's', color: 'url(https://evil.invalid/x.png)' }])[0].color).toBeUndefined();
    expect(cleanSetups([{ id: 's', color: '#abc' }])[0].color).toBe('#abc');
  });

  it('a real IANA time zone is kept', () => {
    expect(cleanSettings({ timezone: 'Asia/Jerusalem' }, base).timezone).toBe('Asia/Jerusalem');
  });

  it('trade numbers that are not finite become safe values', () => {
    const [t] = cleanTrades([{ id: 'n', quantity: 'ten', entryPrice: Number.NaN, exitPrice: 'x', manualPnl: {} }]);
    expect(t.quantity).toBe(0);
    expect(t.entryPrice).toBe(0);
    expect(t.exitPrice).toBeNull();
    expect(t.manualPnl).toBeNull();
  });

  it('a multiplier of zero or less is dropped, so a winner can never show as a loss', () => {
    const [neg, zero, ok] = cleanTrades([
      trade({ id: 'n', entryPrice: 100, exitPrice: 110, multiplier: -2 }),
      trade({ id: 'z', entryPrice: 100, exitPrice: 110, multiplier: 0 }),
      trade({ id: 'o', entryPrice: 100, exitPrice: 110, multiplier: 5 }),
    ]);
    expect([neg.multiplier, zero.multiplier, ok.multiplier]).toEqual([undefined, undefined, 5]);
    expect([netPnl(neg), netPnl(zero), netPnl(ok)]).toEqual([10, 10, 50]);
  });
});

describe('restoring a backup file', () => {
  it('accepts a valid backup', () => {
    const { data, error } = parseBackup(JSON.stringify(journal()));
    expect(error).toBeUndefined();
    expect(data?.trades).toHaveLength(2);
  });

  it.each([
    ['not JSON', '{"version":1,', 'That file is not valid JSON.'],
    ['a JSON string', '"hello"', 'That file is not a Sniper Journal backup.'],
    ['an object without trades', '{"version":1,"accounts":[]}', 'That file does not contain a trades and accounts list.'],
    ['an empty file', '', 'That file is not valid JSON.'],
  ])('refuses %s with a clear message', (_, text, message) => {
    const { data, error } = parseBackup(text);
    expect(data).toBeUndefined();
    expect(error).toBe(message);
  });

  it('refuses a backup made by a newer version, rather than silently dropping what it does not understand', () => {
    const { data, error } = parseBackup(JSON.stringify({ ...journal(), version: 2 }));
    expect(data).toBeUndefined();
    expect(error).toMatch(/newer version/i);
  });

  it('a large backup restores intact', () => {
    const trades = Array.from({ length: 20000 }, (_, i) => trade({ id: `big${i}`, notes: `note ${i}` }));
    const { data } = parseBackup(JSON.stringify(journal({ trades })));
    expect(normalize(data).trades).toHaveLength(20000);
  });
});
