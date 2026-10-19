import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';
import type { JournalStorage } from './types';

export type { CopyReason, JournalStorage } from './types';
export { JournalConflict } from './types';

/**
 * What the app is running on, known at once, and the storage for it, loaded
 * only when the app starts (`init`). Each implementation is a chunk of its
 * own, so a build only ever loads its platform's: the browser version never
 * fetches the Android or Windows code, and the other way round.
 */
interface Platform {
  kind: JournalStorage['kind'];
  device: JournalStorage['device'];
  load(): Promise<JournalStorage>;
}

/**
 * Picks the implementation for whatever the app is running on: the Android
 * (or iPhone) app built with Capacitor, the Windows app built with Tauri, or
 * the desktop app in a browser.
 *
 * This is the one platform check in the codebase. Anything else that differs
 * per platform reads `storage.kind` or `storage.device` instead of asking
 * Capacitor or Tauri itself. (Each implementation says its own kind and
 * device too; tests/storage-index.test.ts checks they agree with these.)
 */
function pick(): Platform {
  if (Capacitor.isNativePlatform()) {
    return { kind: 'native', device: 'phone', load: async () => (await import('./capacitor')).capacitorStorage };
  }
  if (isTauri()) {
    return { kind: 'native', device: 'pc', load: async () => (await import('./tauri')).tauriStorage };
  }
  return { kind: 'web', device: 'pc', load: async () => (await import('./web')).webStorage };
}

const platform = pick();

/** the platform's storage, once loaded; kept even when its own init fails, so a backup can still be handed over */
let loaded: JournalStorage | null = null;
let loading: Promise<JournalStorage> | null = null;
/** whenClosing asked for before the implementation loaded, passed on as soon as it does */
const waitingToClose = new Set<{ save: () => void; stop?: () => void }>();
/** loads it once, however many ask at the same time; one that failed to load is tried again next time */
function implementation(): Promise<JournalStorage> {
  loading ??= platform.load().then(
    (s) => {
      loaded = s;
      for (const wait of waitingToClose) wait.stop = s.whenClosing?.(wait.save);
      waitingToClose.clear();
      return s;
    },
    (err: unknown) => {
      loading = null;
      throw err;
    },
  );
  return loading;
}

/**
 * The storage the rest of the app uses. `kind` and `device` are there from
 * the start (pages read them as they load); everything else goes to the
 * platform's implementation, which `init` loads first. The synchronous parts
 * answer as before it has read anything until then: no version, no
 * location, and no image to show.
 */
export const storage: JournalStorage = {
  kind: platform.kind,
  device: platform.device,
  async init() {
    await (await implementation()).init();
  },
  readJournal: async () => (await implementation()).readJournal(),
  version: () => loaded?.version?.() ?? null,
  location: () => loaded?.location() ?? null,
  writeJournal: async (data) => (await implementation()).writeJournal(data),
  keepCopy: async (data, reason) => (await implementation()).keepCopy(data, reason),
  saveImage: async (blob) => (await implementation()).saveImage(blob),
  // the app shows its loading screen until init has loaded it, so nothing is drawn before
  imageSrc: (name) => loaded?.imageSrc(name) ?? '',
  deleteImage: async (name) => (await implementation()).deleteImage(name),
  findUnusedImages: async (inUse) => (await implementation()).findUnusedImages(inUse),
  removeUnusedImages: async (inUse, approved) => (await implementation()).removeUnusedImages(inUse, approved),
  exportFile: async (filename, content, mimeType) => (await implementation()).exportFile(filename, content, mimeType),
  // asked for as the app opens, before init has loaded the implementation:
  // passed on once it has (or once init loads it on a later try), unless
  // stopped by then
  whenClosing(save) {
    if (loaded) return loaded.whenClosing?.(save) ?? (() => {});
    const wait: { save: () => void; stop?: () => void } = { save };
    waitingToClose.add(wait);
    // a load that fails here fails init too, which tries again
    implementation().catch(() => {});
    return () => {
      waitingToClose.delete(wait);
      wait.stop?.();
    };
  },
};
