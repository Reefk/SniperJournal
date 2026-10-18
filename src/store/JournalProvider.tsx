'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import type { Account, JournalData, Resource, Setup, Trade, TradeInput, Settings, Profile } from '@/lib/types';
import { createDefaultData, normalize } from '@/lib/journal';
import { newerJournal } from '@/lib/journal-version';
import { generateSampleData } from '@/lib/sample';
import { isIncomplete } from '@/lib/trade-math';
import { mergeIssue, mergeTrades as combineTrades } from '@/lib/merge';
import { chartsOnlyInSample, deleteScreenshot, imagesOnlyIn } from '@/lib/screenshots';
import { JournalConflict, storage } from '@/lib/storage';
import { uid } from '@/lib/utils';
import { accountBalances } from './selectors';
import { createAutosave, readPatiently } from './autosave';
import {
  decodeMirror,
  encodeMirror,
  MIRROR_KEY as LOCAL_KEY,
  pickJournal,
  rebaseMirror,
  storeMirror,
  type CopyMiss,
} from './mirror';

/**
 * On a PC the journal is mirrored into the browser on every change, in case
 * the app is closed before the server has written it. A phone app writes to
 * its own folder, so the mirror would only double the memory used; there it
 * is kept only as a fallback while that folder cannot be written.
 */
const MIRROR_ALWAYS = storage.kind === 'web';

/** this page load: every tab shares one mirror, and has to know its own (see mirror.ts) */
const TAB = uid();
const fileVersion = () => storage.version?.() ?? null;

function readMirror(): string | null {
  try {
    return localStorage.getItem(LOCAL_KEY);
  } catch {
    return null;
  }
}

/** null when the copy is in the browser; otherwise why not */
function writeMirror(data: JournalData): CopyMiss | null {
  return storeMirror(encodeMirror(data, fileVersion(), TAB));
}

function removeMirror() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * saved:    the newest change is in the journal file
 * saving:   a change is about to be written
 * browser:  a save failed; changes are kept in the browser (or, on a phone,
 *           temporarily) and the file is tried again until it works
 * unsaved:  as `browser`, but the browser couldn't keep them either (see
 *           `copyMiss`), so the newest changes are only on the screen
 * error:    the file could not be read at startup, so it is never written
 *           over this session; changes are kept in the browser instead, if
 *           it can (see `copyMiss`)
 * conflict: another tab, window or copy of the app saved the journal after
 *           this window opened it, so this window stopped saving (see
 *           `conflict` in the context)
 */
export type SaveStatus = 'saved' | 'saving' | 'browser' | 'unsaved' | 'error' | 'conflict';

/**
 * This window's journal, refused because the file changed elsewhere. `copy`
 * is where it was kept: undefined while that is still being written, null if
 * it could not be.
 */
export interface Conflict {
  journal: JournalData;
  copy: string | null | undefined;
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
  /** adds `trades`, and puts each of `finished` in place of the journal trade with its id */
  importTrades: (trades: Trade[], newSetups: Setup[], finished?: Trade[]) => void;
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

/** what the journal shows, worked out again only when the journal changes */
interface Derived {
  accountTrades: Trade[];
  activeAccount: Account | null;
  activeLabel: string;
  startingBalance: number;
  balances: Record<string, number>;
  sampleCount: number;
}

interface JournalContextValue extends Derived {
  data: JournalData;
  ready: boolean;
  /**
   * The version of the journal found, when a newer app saved it than this one
   * can open: then nothing is opened and nothing is saved, and `ready` stays false.
   */
  newer: number | null;
  actions: Actions;
}

/**
 * How saving is going. Kept apart from the journal: it changes twice for
 * every edit ('saving', then 'saved'), and every page reads the journal, so
 * sharing one context would draw them all again each time. Read it with
 * `useSaveState`.
 */
interface SaveState {
  saveStatus: SaveStatus;
  filePath: string | null;
  /** set once this window stopped saving because the file changed elsewhere */
  conflict: Conflict | null;
  /**
   * Where unsaved changes from another window were kept, when they turned up
   * in the browser at startup but were made on top of an older file.
   */
  recovered: string | null;
  dismissRecovered: () => void;
  /**
   * Why the last copy of the journal meant for the browser isn't there, or
   * null if it is (or none was needed). On a PC every change is copied; on a
   * phone only while its folder can't be written.
   */
  copyMiss: CopyMiss | null;
}

const JournalContext = createContext<JournalContextValue | null>(null);
const SaveStateContext = createContext<SaveState | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<JournalData>(createDefaultData);
  const [ready, setReady] = useState(false);
  const [newer, setNewer] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [recovered, setRecovered] = useState<string | null>(null);
  const [copyMiss, setCopyMiss] = useState<CopyMiss | null>(null);
  const diskReadable = useRef(true);
  const firstLoad = useRef(true);
  const dataRef = useRef<JournalData>(createDefaultData());

  // when changes reach the file, trying again after a failed save, and
  // stopping for good when the file was changed in another window
  const [autosave] = useState(() =>
    createAutosave<JournalData>(
      async (snapshot) => {
        const from = fileVersion();
        setFilePath(await storage.writeJournal(snapshot));
        // this tab's copy in the browser now sits on top of the file it just
        // wrote (if it can't be told, the copy is no newer than the file, so
        // the file opens at startup all the same)
        if (MIRROR_ALWAYS) {
          const rebased = rebaseMirror(readMirror(), TAB, from, fileVersion());
          if (rebased) storeMirror(rebased);
        }
      },
      {
        saved: () => {
          setSaveStatus('saved');
          // the folder has it now; a leftover fallback copy would only go stale
          if (!MIRROR_ALWAYS) {
            removeMirror();
            setCopyMiss(null);
          }
        },
        saving: () => setSaveStatus('saving'),
        failed: (newest) => {
          setSaveStatus('browser');
          if (!MIRROR_ALWAYS) setCopyMiss(writeMirror(newest));
        },
        stopped: (newest) => {
          setSaveStatus('conflict');
          setConflict({ journal: newest, copy: undefined });
          storage.keepCopy(newest, 'conflict').then(
            (copy) => {
              setConflict({ journal: newest, copy });
              // kept safely, so this tab's copy in the browser must not come
              // back over the other window's work on a reload
              if (decodeMirror(readMirror())?.tab === TAB) removeMirror();
            },
            () => setConflict({ journal: newest, copy: null }),
          );
        },
      },
      (reason) => reason instanceof JournalConflict,
    ),
  );
  useEffect(() => () => autosave.dispose(), [autosave]);

  // ---- load: the file, unless the browser holds newer changes made on top of it ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let fromDisk: JournalData | null = null;
      try {
        fromDisk = await readPatiently(async () => {
          await storage.init();
          return storage.readJournal();
        });
      } catch {
        // a file that cannot be read is never written over: what is in it
        // may be all there is. Changes stay in the browser this session.
        diskReadable.current = false;
      }

      const { journal: winner, stale } = pickJournal(
        fromDisk,
        diskReadable.current ? fileVersion() : null,
        decodeMirror(readMirror()),
      );

      // a journal a newer version of the app saved, in the file or in the
      // browser's copy about to be opened, is neither opened nor written over:
      // this version would quietly drop what that one added
      const tooNew = newerJournal(fromDisk) ?? newerJournal(winner);
      if (tooNew != null) {
        if (!cancelled) {
          setFilePath(storage.location());
          setNewer(tooNew);
        }
        return;
      }

      // changes from a window that lost to another window's save, closed
      // before they could be kept: kept as a copy now, not opened over the
      // newer journal. If that fails they stay in the browser only until
      // this window's next change, which is the most that can be done here.
      if (stale) {
        try {
          const copy = await storage.keepCopy(stale, 'conflict');
          removeMirror();
          if (!cancelled) setRecovered(copy ?? 'your backups');
        } catch {
          /* nowhere else to put them */
        }
      }

      if (!cancelled) {
        // where the journal lives is known from the read, before any save
        setFilePath(storage.location());
        setData(normalize(winner));
        setSaveStatus(diskReadable.current ? 'saved' : 'error');
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- save: to the browser mirror at once, to disk after a short pause ----
  useEffect(() => {
    if (!ready) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }

    // a window that stopped saving leaves the shared browser copy to the others
    if (autosave.stopped) return;
    if (MIRROR_ALWAYS || !diskReadable.current) setCopyMiss(writeMirror(data));
    if (diskReadable.current) autosave.change(data);
  }, [data, ready, autosave]);

  const dismissRecovered = useCallback(() => setRecovered(null), []);

  // a phone can suspend the app the moment it leaves the screen, so a save
  // still waiting out its 350ms is written straight away instead
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') autosave.flush();
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [autosave]);

  // and a desktop window closed within that moment waits for it
  useEffect(() => storage.whenClosing?.(() => autosave.flush()), [autosave]);

  // the merge action needs to read the trades it is folding together
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ---- theme on <html> ----
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', data.settings.theme === 'light');
    root.style.colorScheme = data.settings.theme;
    // on a phone the status bar icons sit on the app's own background
    if (storage.device === 'phone') {
      void SystemBars.setStyle({
        style: data.settings.theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark,
      }).catch(() => undefined);
    }
  }, [data.settings.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('faded-placeholders', data.settings.fadedPlaceholders === true);
  }, [data.settings.fadedPlaceholders]);

  const mutate = useCallback((fn: (draft: JournalData) => JournalData) => {
    setData((prev) => ({ ...fn(prev), updatedAt: new Date().toISOString() }));
  }, []);

  const actions = useMemo<Actions>(
    () => ({
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
        // a deleted trade should not leave its chart behind in the data folder
        const trades = dataRef.current.trades;
        const removed = trades.filter((t) => set.has(t.id));
        for (const name of imagesOnlyIn(
          removed,
          trades.filter((t) => !set.has(t.id)),
        ))
          void deleteScreenshot(name);
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
        // the merged trade shows one chart; the other parts' charts go with them
        const others = dataRef.current.trades.filter((t) => !set.has(t.id));
        for (const name of imagesOnlyIn(legs, [...others, merged])) void deleteScreenshot(name);
        mutate((d) => ({
          ...d,
          trades: [...d.trades.filter((t) => !set.has(t.id)), merged],
        }));
        return null;
      },
      importTrades: (trades, newSetups, finished = []) => {
        // a finished trade replaces the open one it was made from
        const byId = new Map(finished.map((t) => [t.id, t]));
        mutate((d) => ({
          ...d,
          trades: [...d.trades.map((t) => byId.get(t.id) ?? t), ...trades],
          setups: [...d.setups, ...newSetups],
        }));
      },
      addAccount: (name, startingBalance) => {
        const account: Account = { id: uid(), name, startingBalance, createdAt: new Date().toISOString() };
        mutate((d) => ({ ...d, accounts: [...d.accounts, account], activeAccountId: account.id }));
      },
      updateAccount: (id, patch) => {
        mutate((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
      },
      deleteAccount: (id) => {
        // its trades go for good, and their charts with them (the last account stays)
        const current = dataRef.current;
        if (current.accounts.some((a) => a.id !== id)) {
          const removed = current.trades.filter((t) => t.accountId === id);
          const remaining = current.trades.filter((t) => t.accountId !== id);
          for (const name of imagesOnlyIn(removed, remaining)) void deleteScreenshot(name);
        }
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
        // the old test trades make way for new ones, and their charts go with them
        for (const name of chartsOnlyInSample(dataRef.current.trades)) void deleteScreenshot(name);
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
        for (const name of chartsOnlyInSample(dataRef.current.trades)) void deleteScreenshot(name);
        mutate((d) => ({
          ...d,
          trades: d.trades.filter((t) => !t.isSample),
          setups: d.setups.filter((s) => !s.isSample),
        }));
      },
      // The chart images of the journal being replaced go with it, apart from
      // those the incoming journal still uses. The copy Settings keeps first
      // (before-restore, before-erase) is the journal only, so restored later,
      // its trades come back without those charts. Settings says so.
      replaceAll: (next) => {
        const incoming = normalize(next);
        for (const name of imagesOnlyIn(dataRef.current.trades, incoming.trades)) void deleteScreenshot(name);
        setData({ ...incoming, updatedAt: new Date().toISOString() });
      },
      resetAll: () => {
        for (const name of imagesOnlyIn(dataRef.current.trades, [])) void deleteScreenshot(name);
        setData({ ...createDefaultData(), onboarded: true });
      },
    }),
    [mutate],
  );

  // keyed on the journal alone: every page's statistics are keyed on
  // `accountTrades`, so a new array here means computing them all again
  const derived = useMemo<Derived>(() => {
    const isAll = data.activeAccountId === 'all';
    const accountTrades = isAll ? data.trades : data.trades.filter((t) => t.accountId === data.activeAccountId);
    const activeAccount = data.accounts.find((a) => a.id === data.activeAccountId) ?? null;

    // counted like every statistic, so it matches the end of the equity curve,
    // unless Settings says excluded trades count toward the balance too
    const balances = accountBalances(data, data.settings.countExcludedInBalance === true);

    return {
      accountTrades,
      activeAccount,
      activeLabel: isAll ? 'All accounts' : (activeAccount?.name ?? 'Portfolio'),
      startingBalance: isAll
        ? data.accounts.reduce((a, acc) => a + acc.startingBalance, 0)
        : (activeAccount?.startingBalance ?? 0),
      balances,
      sampleCount: data.trades.filter((t) => t.isSample).length,
    };
  }, [data]);

  const value = useMemo<JournalContextValue>(
    () => ({ data, ready, newer, actions, ...derived }),
    [data, ready, newer, actions, derived],
  );

  const saveState = useMemo<SaveState>(
    () => ({
      // "kept in the browser" only while it really is
      saveStatus: saveStatus === 'browser' && copyMiss ? 'unsaved' : saveStatus,
      filePath,
      conflict,
      recovered,
      dismissRecovered,
      copyMiss,
    }),
    [saveStatus, filePath, conflict, recovered, dismissRecovered, copyMiss],
  );

  return (
    <JournalContext.Provider value={value}>
      <SaveStateContext.Provider value={saveState}>{children}</SaveStateContext.Provider>
    </JournalContext.Provider>
  );
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournal must be used inside JournalProvider');
  return ctx;
}

/** how saving is going; only what shows it should read this (see SaveState) */
export function useSaveState(): SaveState {
  const ctx = useContext(SaveStateContext);
  if (!ctx) throw new Error('useSaveState must be used inside JournalProvider');
  return ctx;
}
