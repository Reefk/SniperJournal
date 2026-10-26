'use client';

import { useState } from 'react';
import type { Trade } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { SESSIONS, sessionName } from '@/lib/sessions';
import { decimalMark, tr } from '@/lib/i18n';
import { toNumberOrNull } from '@/lib/utils';
import { feeAtRate, type FeeRate } from '@/lib/fee-rate';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { TagInput } from '@/components/ui/TagInput';
import { rich } from '@/components/ui/Rich';

const KEEP = '__keep__';

/**
 * Fills in the context a broker export never contains — which setup it was,
 * what you were thinking, what it cost — across many trades at once.
 */
export function BulkDetailsModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { data, actions } = useJournal();
  const { toast } = useUI();
  const [setupId, setSetupId] = useState(KEEP);
  const [session, setSession] = useState(KEEP);
  const [tags, setTags] = useState<string[]>([]);
  const [fees, setFees] = useState('');
  const [feesPer, setFeesPer] = useState<FeeRate['per']>('trade');
  const [leverage, setLeverage] = useState('');
  const [notes, setNotes] = useState('');
  const [replaceTags, setReplaceTags] = useState(false);

  const tagSuggestions = [...new Set(data.trades.flatMap((t) => t.tags))];
  const count = ids.length;

  const apply = () => {
    const patch: Partial<Trade> = {};
    if (setupId !== KEEP) patch.setupId = setupId || undefined;
    if (session !== KEEP) patch.session = session || undefined;
    const feeValue = toNumberOrNull(fees);
    const fee: FeeRate | null = fees.trim() && feeValue != null ? { per: feesPer, amount: feeValue } : null;
    if (fee?.per === 'trade') patch.fees = fee.amount;
    const levValue = toNumberOrNull(leverage);
    if (leverage.trim() && levValue != null) patch.leverage = levValue;
    if (notes.trim()) patch.notes = notes.trim();

    if (tags.length && replaceTags) {
      patch.tags = tags;
      actions.patchTrades(ids, patch);
    } else if (tags.length) {
      // appending differs per trade, so those go one at a time
      const selected = data.trades.filter((t) => ids.includes(t.id));
      actions.patchTrades(ids, patch);
      for (const t of selected) {
        const merged = [...new Set([...t.tags, ...tags])];
        actions.patchTrades([t.id], { tags: merged });
      }
    } else {
      actions.patchTrades(ids, patch);
    }
    // a fee per contract differs with each trade's size, so those go one at a time too
    if (fee?.per === 'contract') {
      for (const t of data.trades.filter((t) => ids.includes(t.id))) {
        actions.patchTrades([t.id], { fees: feeAtRate(t, fee) });
      }
    }

    toast(tr('bulk.updated', { count }));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop={false}
      size="md"
      title={tr('bulk.title', { count })}
      description={tr('bulk.hint')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button variant="primary" onClick={apply}>
            {tr('bulk.apply', { count })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('form.setup')} hint={data.setups.length ? undefined : tr('bulk.noSetups')}>
            <Select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
              <option value={KEEP}>{tr('bulk.unchanged')}</option>
              <option value="">{tr('form.noSetup')}</option>
              {data.setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tr('form.session')}>
            <Select value={session} onChange={(e) => setSession(e.target.value)}>
              <option value={KEEP}>{tr('bulk.unchanged')}</option>
              <option value="">{tr('form.none')}</option>
              {SESSIONS.map((s) => (
                <option key={s} value={s}>
                  {sessionName(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('form.fees')} hint={tr('bulk.blankKeeps')}>
            <Input
              inputMode="decimal"
              className="num"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              placeholder={tr('goals.example', { n: decimalMark(feesPer === 'contract' ? '0.95' : '1.24') })}
            />
          </Field>
          <Field label={tr('bulk.charged')} hint={feesPer === 'contract' ? tr('bulk.inAndOut') : undefined}>
            <Select value={feesPer} onChange={(e) => setFeesPer(e.target.value as FeeRate['per'])}>
              <option value="trade">{tr('bulk.perTrade')}</option>
              <option value="contract">{tr('bulk.perContract')}</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('form.leverage')} hint={tr('bulk.blankKeeps')}>
            <Input
              inputMode="decimal"
              className="num"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              placeholder={tr('goals.example', { n: '10' })}
            />
          </Field>
        </div>

        <Field label={tr('form.tags')} hint={replaceTags ? tr('bulk.tagsReplace') : tr('bulk.tagsAdd')}>
          <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
        </Field>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="size-3.5"
            checked={replaceTags}
            onChange={(e) => setReplaceTags(e.target.checked)}
          />
          {tr('bulk.replaceTags')}
        </label>

        <Field label={tr('form.notes')} hint={tr('bulk.notesHint')}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr('bulk.notesPlaceholder')}
          />
        </Field>

        <p className="text-xs leading-relaxed text-faint">
          {rich(tr('bulk.oneAtATime'), {
            phone: (text) => <span className="md:hidden">{text}</span>,
            pc: (text) => <span className="max-md:hidden">{text}</span>,
          })}
        </p>
      </div>
    </Modal>
  );
}
