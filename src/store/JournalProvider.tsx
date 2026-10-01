'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import type { Account, JournalData, Resource, Setup, Trade, TradeInput, Settings, Profile } from '@/lib/types';
import { generateSampleData } from '@/lib/sample';
import { isIncomplete, netPnl } from '@/lib/trade-math';
import { mergeIssue, mergeTrades as combineTrades } from '@/lib/merge';
import { uid } from '@/lib/utils';

const LOCAL_KEY = 'sniper-journal:v1';

export type SaveStatus = 'saved' | 'saving' | 'browser' | 'error';

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

/** Fills in anything an older or hand-edited file is missing */
function normalize(input: Partial<JournalData> | null): JournalData {
  const base = createDefaultData();
  if (!input) return base;
  const accounts = Array.isArray(input.accounts) && input.accounts.length ? input.accounts : base.accounts;
  const activeAccountId =
    input.activeAccountId === 'all' || accounts.some((a) => a.id === input.activeAccountId)
      ? (input.activeAccountId as string)
      : accounts[0].id;
  return {
    version: 1,
    updatedAt: input.updatedAt ?? base.updatedAt,
    onboarded: Boolean(input.onboarded),
    profile: { ...base.profile, ...(input.profile ?? {}) },
    settings: { ...base.settings, ...(input.settings ?? {}) },
    accounts,
    activeAccountId,
    trades: (input.trades ?? []).map((t) => ({ ...t, tags: t.tags ?? [], fees: t.fees ?? 0 })),
    setups: (input.setups ?? []).map((s) => ({ ...s, rules: s.rules ?? [] })),
    resources: input.resources ?? [],
  };
}

interface Actions {
  addTrade: (input: TradeInput) => void;
  updateTrade: (id: string, input: TradeInput) => void;
  deleteTrades: (ids: string[]) => void;
  /** apply the same handful of fields to several trades at once */
  patchTrades: (ids: string[], patch: Partial<Trade>) => void;
  /** fold partial fills of one position back into a single trade */
  mergeTrades: (ids: string[]) => string | null;
  setExcluded: (ids: string[], excluded: boolean) => void;
  importTrades: (trades: Trade[], newSetups: Setup[]) => void;
  addAccount: (name: string, startingBalance: number) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  setActiveAccount: (id: string) => void;
  upsertSetup: (setup: Setup) => void;
  deleteSetup: (id: string) => void;
  upsertResource: (resource: Resource) => void;
  deleteResource: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  completeOnboarding: (input: { name: string; accountName: string; startingBalance: number; currency: string }) => void;
  loadSampleData: () => void;
  clearSampleData: () => void;
  replaceAll: (data: JournalData) => void;
  resetAll: () => void;
}

interface JournalContextValue {
  data: JournalData;
  ready: boolean;
  saveStatus: SaveStatus;
  filePath: string | null;
  actions: Actions;
  accountTrades: Trade[];
  activeAccount: Account | null;
  activeLabel: string;
  startingBalance: number;
  balances: Record<string, number>;
  sampleCount: number;
}

const JournalContext = createContext<JournalContextValue | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<JournalData>(createDefaultData);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [filePath, setFilePath] = useState<string | null>(null);
  const diskAvailable = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoad = useRef(true);
  const dataRef = useRef<JournalData>(createDefaultData());

  // ---- load: prefer whichever copy is newer, disk or this browser ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let fromDisk: JournalData | null = null;
      try {
        const res = await fetch('/api/journal', { cache: 'no-store' });
        const json = await res.json();
        if (json?.ok) fromDisk = json.data ?? null;
        else diskAvailable.current = false;
      } catch {
        diskAvailable.current = false;
      }

      let fromBrowser: JournalData | null = null;
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) fromBrowser = JSON.parse(raw);
      } catch {
        /* ignore an unreadable mirror */
      }

      const winner =
        fromDisk && fromBrowser
          ? (fromBrowser.updatedAt ?? '') > (fromDisk.updatedAt ?? '') ? fromBrowser : fromDisk
          : fromDisk ?? fromBrowser;

      if (!cancelled) {
        setData(normalize(winner));
        setSaveStatus(diskAvailable.current ? 'saved' : 'browser');
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- save: debounced, to disk and to the browser mirror ----
  useEffect(() => {
    if (!ready) return;
    if (firstLoad.current) { firstLoad.current = false; return; }

    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch { /* quota */ }

    if (!diskAvailable.current) { setSaveStatus('browser'); return; }
    setSaveStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/journal', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json?.ok) {
          setFilePath(json.path ?? null);
          setSaveStatus('saved');
        } else setSaveStatus('error');
      } catch {
        diskAvailable.current = false;
        setSaveStatus('browser');
      }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [data, ready]);

  // the merge action needs to read the trades it is folding together
  useEffect(() => { dataRef.current = data; }, [data]);

  // ---- theme on <html> ----
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', data.settings.theme === 'light');
    root.style.colorScheme = data.settings.theme;
  }, [data.settings.theme]);

  const mutate = useCallback((fn: (draft: JournalData) => JournalData) => {
    setData((prev) => ({ ...fn(prev), updatedAt: new Date().toISOString() }));
  }, []);

  const actions = useMemo<Actions>(() => ({
    addTrade: (input) => {
      const now = new Date().toISOString();
      mutate((d) => ({ ...d, trades: [...d.trades, { ...input, id: uid(), createdAt: now, updatedAt: now }] }));
    },
    updateTrade: (id, input) => {
      const now = new Date().toISOString();
      mutate((d) => ({
        ...d,
        trades: d.trades.map((t) => {
          if (t.id !== id) return t;
          const next: Trade = { ...t, ...input, id, createdAt: t.createdAt, updatedAt: now };
          // the gaps are filled or they are not; the flag follows the trade
          next.needsReview = isIncomplete(next) ? true : undefined;
          return next;
        }),
      }));
    },
    patchTrades: (ids, patch) => {
      const set = new Set(ids);
      const now = new Date().toISOString();
      mutate((d) => ({
        ...d,
        trades: d.trades.map((t) => {
          if (!set.has(t.id)) return t;
          const next: Trade = { ...t, ...patch, id: t.id, createdAt: t.createdAt, updatedAt: now };
          next.needsReview = isIncomplete(next) ? true : undefined;
          return next;
        }),
      }));
    },
    deleteTrades: (ids) => {
      const set = new Set(ids);
      mutate((d) => ({ ...d, trades: d.trades.filter((t) => !set.has(t.id)) }));
    },
    setExcluded: (ids, excluded) => {
      const set = new Set(ids);
      mutate((d) => ({ ...d, trades: d.trades.map((t) => (set.has(t.id) ? { ...t, excluded } : t)) }));
    },
    mergeTrades: (ids) => {
      const set = new Set(ids);
      const legs = dataRef.current.trades.filter((t) => set.has(t.id));
      const issue = mergeIssue(legs);
      if (issue) return issue;
      const merged = combineTrades(legs);
      mutate((d) => ({
        ...d,
        trades: [...d.trades.filter((t) => !set.has(t.id)), merged],
      }));
      return null;
    },
    importTrades: (trades, newSetups) => {
      mutate((d) => ({ ...d, trades: [...d.trades, ...trades], setups: [...d.setups, ...newSetups] }));
    },
    addAccount: (name, startingBalance) => {
      const account: Account = { id: uid(), name, startingBalance, createdAt: new Date().toISOString() };
      mutate((d) => ({ ...d, accounts: [...d.accounts, account], activeAccountId: account.id }));
    },
    updateAccount: (id, patch) => {
      mutate((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
    },
    deleteAccount: (id) => {
      mutate((d) => {
        const accounts = d.accounts.filter((a) => a.id !== id);
        if (!accounts.length) return d;
        return {
          ...d,
          accounts,
          trades: d.trades.filter((t) => t.accountId !== id),
          activeAccountId: d.activeAccountId === id ? accounts[0].id : d.activeAccountId,
        };
      });
    },
    setActiveAccount: (id) => mutate((d) => ({ ...d, activeAccountId: id })),
    upsertSetup: (setup) => {
      mutate((d) => ({
        ...d,
        setups: d.setups.some((s) => s.id === setup.id)
          ? d.setups.map((s) => (s.id === setup.id ? setup : s))
          : [...d.setups, setup],
      }));
    },
    deleteSetup: (id) => {
      mutate((d) => ({
        ...d,
        setups: d.setups.filter((s) => s.id !== id),
        trades: d.trades.map((t) => (t.setupId === id ? { ...t, setupId: undefined } : t)),
      }));
    },
    upsertResource: (resource) => {
      mutate((d) => ({
        ...d,
        resources: d.resources.some((r) => r.id === resource.id)
          ? d.resources.map((r) => (r.id === resource.id ? resource : r))
          : [...d.resources, resource],
      }));
    },
    deleteResource: (id) => mutate((d) => ({ ...d, resources: d.resources.filter((r) => r.id !== id) })),
    updateSettings: (patch) => mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    updateProfile: (patch) => mutate((d) => ({ ...d, profile: { ...d.profile, ...patch } })),
    completeOnboarding: ({ name, accountName, startingBalance, currency }) => {
      mutate((d) => ({
        ...d,
        onboarded: true,
        profile: { ...d.profile, name },
        settings: { ...d.settings, currency },
        accounts: d.accounts.map((a, i) => (i === 0 ? { ...a, name: accountName, startingBalance } : a)),
      }));
    },
    loadSampleData: () => {
      mutate((d) => {
        const accountId = d.activeAccountId === 'all' ? d.accounts[0].id : d.activeAccountId;
        const { trades, setups } = generateSampleData(accountId);
        const withoutOldSample = {
          trades: d.trades.filter((t) => !t.isSample),
          setups: d.setups.filter((s) => !s.isSample),
        };
        // give the demo account a starting balance so the equity curve and
        // drawdown percentages have something to be measured against
        const accounts = d.accounts.map((a) =>
          a.id === accountId && a.startingBalance === 0 ? { ...a, startingBalance: 25000 } : a,
        );
        return {
          ...d,
          accounts,
          trades: [...withoutOldSample.trades, ...trades],
          setups: [...withoutOldSample.setups, ...setups],
        };
      });
    },
    clearSampleData: () => {
      mutate((d) => ({
        ...d,
        trades: d.trades.filter((t) => !t.isSample),
        setups: d.setups.filter((s) => !s.isSample),
      }));
    },
    replaceAll: (next) => setData({ ...normalize(next), updatedAt: new Date().toISOString() }),
    resetAll: () => setData({ ...createDefaultData(), onboarded: true }),
  }), [mutate]);

  const value = useMemo<JournalContextValue>(() => {
    const isAll = data.activeAccountId === 'all';
    const accountTrades = isAll ? data.trades : data.trades.filter((t) => t.accountId === data.activeAccountId);
    const activeAccount = data.accounts.find((a) => a.id === data.activeAccountId) ?? null;

    const balances: Record<string, number> = {};
    for (const account of data.accounts) {
      const net = data.trades.filter((t) => t.accountId === account.id).reduce((a, t) => a + netPnl(t), 0);
      balances[account.id] = account.startingBalance + net;
    }

    return {
      data,
      ready,
      saveStatus,
      filePath,
      actions,
      accountTrades,
      activeAccount,
      activeLabel: isAll ? 'All accounts' : activeAccount?.name ?? 'Portfolio',
      startingBalance: isAll
        ? data.accounts.reduce((a, acc) => a + acc.startingBalance, 0)
        : activeAccount?.startingBalance ?? 0,
      balances,
      sampleCount: data.trades.filter((t) => t.isSample).length,
    };
  }, [data, ready, saveStatus, filePath, actions]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournal must be used inside JournalProvider');
  return ctx;
}
