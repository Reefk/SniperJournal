import { Capacitor } from '@capacitor/core';
import type { JournalStorage } from './types';
import { capacitorStorage } from './capacitor';
import { webStorage } from './web';

export type { JournalStorage } from './types';
export { StorageUnavailable } from './types';

/**
 * Picks the implementation for whatever the app is running on: the Android
 * (or iPhone) app built with Capacitor, or the desktop app in a browser.
 *
 * This is the one platform check in the codebase. Anything else that differs
 * per platform reads `storage.kind` instead of asking Capacitor itself.
 */
function pick(): JournalStorage {
  if (Capacitor.isNativePlatform()) return capacitorStorage;
  return webStorage;
}

export const storage: JournalStorage = pick();
