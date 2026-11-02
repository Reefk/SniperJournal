'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardCopy } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { openingBalance } from '@/store/selectors';
import { dayReview, tradeReview, weekReview, type ReviewBook } from '@/lib/review-text';
import { mistakeList } from '@/lib/mistakes';
import { tradeDay } from '@/lib/trade-math';
import { tr } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';

/** what is copied: a trade (as the trade form shows it), a day ('YYYY-MM-DD'), or a week from one day to another */
export type ReviewOf =
  { kind: 'trade'; trade: Trade } | { kind: 'day'; day: string } | { kind: 'week'; from: string; to: string };

const NAMES = { trade: 'review.copyTrade', day: 'review.copyDay', week: 'review.copyWeek' } as const;

/**
 * Copy for review: a button that opens the text of a trade, a day or a week,
 * to paste into any AI chat or send to a mentor (lib/review-text.ts). The app
 * sends nothing: the text goes to the clipboard, or, where the device won't
 * allow that, is selected for the trader to copy by hand.
 *
 * `look`: a button with its label; the icon alone (a Calendar week); or the
 * label from md up and the icon alone on a phone (the trade form's footer).
 * `name`: the button's name where there are several, as the weeks of a month.
 *
 * The window is drawn at the end of the page, not where the button is: from
 * the trade form, Enter in it would otherwise submit the form underneath.
 */
export function CopyForReview({
  of,
  look = 'label',
  name = tr(NAMES[of.kind]),
}: {
  of: ReviewOf;
  look?: 'label' | 'icon' | 'compact';
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {look === 'icon' ? (
        <Button size="icon" variant="ghost" aria-label={name} title={name} onClick={() => setOpen(true)}>
          <ClipboardCopy className="size-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          className={look === 'compact' ? 'max-md:size-11 max-md:px-0' : undefined}
          title={name}
          onClick={() => setOpen(true)}
        >
          <ClipboardCopy className="size-4" />
          {look === 'compact' ? (
            <>
              <span className="max-md:hidden">{tr('review.copy')}</span>
              <span className="sr-only md:hidden">{name}</span>
            </>
          ) : (
            tr('review.copy')
          )}
        </Button>
      )}
      {open && createPortal(<ReviewDialog of={of} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ReviewDialog({ of, onClose }: { of: ReviewOf; onClose: () => void }) {
  const { data, accountTrades, startingBalance } = useJournal();
  const { toast } = useUI();
  const hintId = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  // with amounts hidden (the eye in the header) they stay out of the text too
  const hidden = data.settings.hideMoney === true;
  const [leaveOut, setLeaveOut] = useState(hidden);
  const [failed, setFailed] = useState(false);
  const withoutMoney = hidden || leaveOut;

  const text = useMemo(() => {
    const book: ReviewBook = {
      setups: data.setups,
      mistakes: mistakeList(data.settings),
      goals: data.settings.goals,
      currency: data.settings.currency,
      note: data.settings.reviewNote,
    };
    // the % is of the balance the trade's day, the day or the week began with, as on the Dashboard
    const start = of.kind === 'trade' ? tradeDay(of.trade) : of.kind === 'day' ? of.day : of.from;
    const opening =
      startingBalance > 0
        ? openingBalance(
            startingBalance,
            accountTrades.filter((t) => tradeDay(t) < start),
          )
        : null;
    const money = { leaveOut: withoutMoney, opening };
    if (of.kind === 'trade') return tradeReview(of.trade, book, money);
    if (of.kind === 'day')
      return dayReview(
        of.day,
        accountTrades.filter((t) => tradeDay(t) === of.day),
        book,
        money,
      );
    return weekReview(of.from, of.to, accountTrades, book, money);
  }, [of, data, accountTrades, startingBalance, withoutMoney]);

  const copied = () => {
    toast(tr('review.copied'));
    onClose();
  };

  const copy = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      copied();
      return;
    } catch {
      // no clipboard here, or it was refused: the older way, from the selected text
    }
    box.current?.focus();
    box.current?.select();
    let done = false;
    try {
      done = document.execCommand('copy');
    } catch {
      done = false;
    }
    if (done) copied();
    // the text stays selected, for the trader to copy by hand
    else setFailed(true);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={tr(NAMES[of.kind])}
      description={tr('review.dialog')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tr('common.close')}
          </Button>
          <Button variant="primary" onClick={copy}>
            <ClipboardCopy className="size-4" /> {tr('review.copy')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-fg">
            <input
              type="checkbox"
              className="size-4"
              checked={withoutMoney}
              disabled={hidden}
              aria-describedby={hintId}
              onChange={(e) => setLeaveOut(e.target.checked)}
            />
            {tr('review.leaveOut')}
          </label>
          <p id={hintId} className="mt-1 ps-6 text-xs text-muted">
            {tr(hidden ? 'review.leaveOut.hidden' : 'review.leaveOut.hint')}
          </p>
        </div>
        <Field label={tr('review.text')}>
          <Textarea ref={box} readOnly value={text} dir="auto" rows={14} className="text-xs" />
        </Field>
        {failed && (
          <p role="alert" className="text-sm text-loss">
            {tr('review.failed')}
          </p>
        )}
      </div>
    </Modal>
  );
}
