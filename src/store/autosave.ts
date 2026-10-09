/**
 * When the journal is written to its file.
 *
 * A change is written after a short pause, so a burst of edits becomes one
 * save. A save that fails (the file held by antivirus, the server
 * restarting, a full disk) is tried again with the newest journal after a
 * growing pause: 1s, 2s, 5s, 10s, then every 30s for as long as it takes.
 * Changes made in the meantime go with that next try, and the first save
 * that succeeds puts everything back to normal.
 *
 * No React here, so it can be tested on its own (tests/autosave.test.ts).
 */
export const SAVE_PAUSE_MS = 350;
export const RETRY_PAUSES_MS = [1000, 2000, 5000, 10000, 30000];
/** at startup the file may only be busy for a moment */
export const READ_RETRY_PAUSES_MS = [500, 1500];

export interface AutosaveEvents<T> {
  /** the newest change is in the file */
  saved: () => void;
  /** a change is waiting to be written */
  saving: () => void;
  /** a save failed; `newest` will be tried again */
  failed: (newest: T) => void;
}

export interface Autosave<T> {
  /** a save has failed and none has succeeded since */
  readonly failing: boolean;
  change: (snapshot: T) => void;
  /** write a change that is waiting out its pause right now (the app is being hidden) */
  flush: () => void;
  dispose: () => void;
}

export function createAutosave<T>(write: (snapshot: T) => Promise<unknown>, on: AutosaveEvents<T>): Autosave<T> {
  let newest: T | undefined;
  /** `newest` is not known to be in the file yet */
  let unsaved = false;
  /** the last snapshot handed to `write` */
  let sent: T | undefined;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const after = (ms: number) => {
    cancel();
    timer = setTimeout(attempt, ms);
  };

  function attempt() {
    cancel();
    if (!unsaved) return;
    const snapshot = newest as T;
    sent = snapshot;
    write(snapshot).then(
      () => {
        failures = 0;
        if (snapshot === newest) {
          unsaved = false;
          on.saved();
        } else if (newest !== sent && !timer) {
          // changed while the disk was failing; it is back, so write that now
          on.saving();
          after(SAVE_PAUSE_MS);
        }
      },
      () => {
        failures += 1;
        on.failed(newest as T);
        // a newer save already on its way decides what happens next
        if (snapshot === sent) after(RETRY_PAUSES_MS[Math.min(failures, RETRY_PAUSES_MS.length) - 1]);
      },
    );
  }

  return {
    get failing() {
      return failures > 0;
    },
    change(snapshot) {
      newest = snapshot;
      unsaved = true;
      if (failures > 0) {
        // still failing: the try already planned takes this change along
        on.failed(snapshot);
        return;
      }
      on.saving();
      after(SAVE_PAUSE_MS);
    },
    flush() {
      if (timer && failures === 0) attempt();
    },
    dispose: cancel,
  };
}

/** read, trying again a couple of times before giving up */
export async function readPatiently<T>(read: () => Promise<T>, pauses: number[] = READ_RETRY_PAUSES_MS): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (err) {
      if (attempt >= pauses.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, pauses[attempt]));
    }
  }
}
