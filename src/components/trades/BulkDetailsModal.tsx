'use client';

import { useState } from 'react';
import type { Trade } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { SESSIONS } from '@/lib/sessions';
import { toNumberOrNull } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { TagInput } from '@/components/ui/TagInput';

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
    if (fees.trim() && feeValue != null) patch.fees = feeValue;
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

    toast(`Updated ${count} ${count === 1 ? 'trade' : 'trades'}`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop={false}
      size="md"
      title={`Add details to ${count} ${count === 1 ? 'trade' : 'trades'}`}
      description="Anything you leave untouched stays as it is on each trade."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={apply}>
            Apply to {count}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Setup" hint={data.setups.length ? undefined : 'none in your playbook yet'}>
            <Select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
              <option value={KEEP}>Leave unchanged</option>
              <option value="">No setup</option>
              {data.setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Session">
            <Select value={session} onChange={(e) => setSession(e.target.value)}>
              <option value={KEEP}>Leave unchanged</option>
              <option value="">None</option>
              {SESSIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fees per trade" hint="leave blank to keep">
            <Input
              inputMode="decimal"
              className="num"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              placeholder="e.g. 1.24"
            />
          </Field>
          <Field label="Leverage" hint="leave blank to keep">
            <Input
              inputMode="decimal"
              className="num"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              placeholder="e.g. 10"
            />
          </Field>
        </div>

        <Field label="Tags" hint={replaceTags ? 'replaces existing tags' : 'added to existing tags'}>
          <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
        </Field>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="size-3.5"
            checked={replaceTags}
            onChange={(e) => setReplaceTags(e.target.checked)}
          />
          Replace existing tags instead of adding to them
        </label>

        <Field label="Notes" hint="leave blank to keep each trade's own note">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Applied to every selected trade"
          />
        </Field>

        <p className="text-xs leading-relaxed text-faint">
          Prices, quantities and times are different on every trade, so those are edited one at a time — click a row to
          open it.
        </p>
      </div>
    </Modal>
  );
}
