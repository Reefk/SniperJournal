import { describe, expect, it } from 'vitest';
import { createConfirmGate } from '@/store/confirm';

/** what a question's promise has settled to so far, without waiting for it */
async function state(answer: Promise<boolean>): Promise<boolean | 'waiting'> {
  return Promise.race([answer, new Promise<'waiting'>((r) => setTimeout(() => r('waiting'), 0))]);
}

describe('the confirmation dialog', () => {
  it("gives the user's answer to whoever asked", async () => {
    const gate = createConfirmGate();
    const yes = gate.ask();
    expect(await state(yes)).toBe('waiting');
    gate.answer(true);
    expect(await state(yes)).toBe(true);

    const no = gate.ask();
    gate.answer(false);
    expect(await state(no)).toBe(false);
  });

  it('answers "no" to a question that a newer one replaced, instead of leaving it waiting forever', async () => {
    const gate = createConfirmGate();
    const first = gate.ask();
    const second = gate.ask();
    expect(await state(first)).toBe(false);
    expect(await state(second)).toBe('waiting');

    // the answer on screen belongs to the newer question
    gate.answer(true);
    expect(await state(second)).toBe(true);
    expect(await first).toBe(false);
  });

  it('ignores an answer when no question is open', async () => {
    const gate = createConfirmGate();
    gate.answer(true);
    const next = gate.ask();
    expect(await state(next)).toBe('waiting');

    gate.answer(false);
    gate.answer(true); // a second click on the same dialog changes nothing
    expect(await state(next)).toBe(false);
  });
});
