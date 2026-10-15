import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';
import type { JournalStorage } from './types';
import { capacitorStorage } from './capacitor';
import { tauriStorage } from './tauri';
import { webStorage } from './web';

export type { CopyReason, JournalStorage } from './types';
export { JournalConflict } from './types';

/**
 * Picks the implementation for whatever the app is running on: the Android
 * (or iPhone) app built with Capacitor, the Windows app built with Tauri, or
 * the desktop app in a browser.
 *
 * This is the one platform check in the codebase. Anything else that differs
 * per platform reads `storage.kind` or `storage.device` instead of asking
 * Capacitor or Tauri itself.
 */
function pick(): JournalStorage {
  if (Capacitor.isNativePlatform()) return capacitorStorage;
  if (isTauri()) return tauriStorage;
  return webStorage;
}

export const storage: JournalStorage = pick();
