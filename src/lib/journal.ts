import { cleanAccounts, cleanResources, cleanSettings, cleanSetups, cleanTrades } from '@/store/sanitize';
import type { Account, JournalData, Profile } from './types';
import { uid } from './utils';

/** A brand-new journal: one empty account, default settings, nothing logged */
export function createDefaultData(): JournalData {
  const now = new Date().toISOString();
  const account: Account = { id: uid(), name: 'Main Portfolio', startingBalance: 0, createdAt: now };
  return {
    version: 1,
    updatedAt: now,
    onboarded: false,
    profile: { name: '' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [account],
    activeAccountId: account.id,
    trades: [],
    setups: [],
    resources: [],
  };
}

/**
 * Fills in anything an older or hand-edited file is missing, and replaces any
 * value of the wrong type (see store/sanitize.ts) so that a damaged journal or
 * backup cannot crash the app every time it opens.
 */
export function normalize(raw: unknown): JournalData {
  const base = createDefaultData();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const input = raw as Partial<Record<keyof JournalData, unknown>>;
  const cleaned = cleanAccounts(input.accounts);
  const accounts = cleaned.length ? cleaned : base.accounts;
  const activeAccountId =
    input.activeAccountId === 'all' || accounts.some((a) => a.id === input.activeAccountId)
      ? (input.activeAccountId as string)
      : accounts[0].id;
  const profile = input.profile && typeof input.profile === 'object' ? (input.profile as Partial<Profile>) : {};
  return {
    version: 1,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : base.updatedAt,
    onboarded: Boolean(input.onboarded),
    profile: { ...base.profile, ...profile, name: typeof profile.name === 'string' ? profile.name : base.profile.name },
    settings: cleanSettings(input.settings, base.settings),
    accounts,
    activeAccountId,
    trades: cleanTrades(input.trades),
    setups: cleanSetups(input.setups),
    resources: cleanResources(input.resources),
  };
}
