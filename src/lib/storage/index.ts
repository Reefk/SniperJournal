import type { JournalStorage } from './types';
import { webStorage } from './web';

export type { JournalStorage } from './types';
export { StorageUnavailable } from './types';

/**
 * Picks the implementation for whatever the app is running on.
 *
 * To add the iPhone build, write `capacitor.ts` implementing JournalStorage
 * and return it here when Capacitor is present:
 *
 *   import { Capacitor } from '@capacitor/core';
 *   if (Capacitor.isNativePlatform()) return capacitorStorage;
 *
 * Nothing else in the app needs to change.
 */
function pick(): JournalStorage {
  return webStorage;
}

export const storage: JournalStorage = pick();
