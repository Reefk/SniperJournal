/**
 * The answer to the confirmation dialog. Only one question is on screen at a
 * time, so asking again while one is still open replaces it, and the replaced
 * question is answered "no". Whoever was waiting on it carries on instead of
 * waiting forever, and nothing destructive happens on a question the user
 * never got to answer.
 *
 * No React here, so it can be tested on its own (tests/confirm.test.ts).
 */
export interface ConfirmGate {
  /** a new question; resolves with the user's answer */
  ask: () => Promise<boolean>;
  /** the user answered the question on screen */
  answer: (yes: boolean) => void;
}

export function createConfirmGate(): ConfirmGate {
  let pending: ((yes: boolean) => void) | null = null;

  const answer = (yes: boolean) => {
    const resolve = pending;
    pending = null;
    resolve?.(yes);
  };

  return {
    ask: () => {
      answer(false);
      return new Promise<boolean>((resolve) => {
        pending = resolve;
      });
    },
    answer,
  };
}
