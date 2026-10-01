'use client';

import { useState } from 'react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { CURRENCIES } from '@/lib/format';
import { toNumberOrNull } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { LogoMark } from '@/components/ui/Logo';

/** First run. Nothing is assumed: the journal starts empty. */
export function WelcomeModal() {
  const { data, actions } = useJournal();
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [accountName, setAccountName] = useState('Main Portfolio');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('USD');

  if (data.onboarded) return null;

  const finish = (withSample: boolean) => {
    actions.completeOnboarding({
      name: name.trim(),
      accountName: accountName.trim() || 'Main Portfolio',
      startingBalance: toNumberOrNull(balance) ?? 0,
      currency,
    });
    if (withSample) {
      actions.loadSampleData();
      toast('Test data loaded. Remove it any time from the banner at the top.', 'info');
    }
  };

  return (
    <Modal open onClose={() => undefined} size="md" closeOnBackdrop={false}>
      <form onSubmit={(e) => { e.preventDefault(); finish(false); }}>
        <div className="flex items-center gap-3 pb-1 pt-2">
          <LogoMark size={40} />
          <div>
            <h2 className="text-lg font-semibold text-fg">Set up your journal</h2>
            <p className="text-sm text-muted">Everything you enter is saved on this computer.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Your name" hint="optional" className="col-span-2">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown in the header" />
          </Field>
          <Field label="Account name">
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Starting balance" hint="used for the equity curve and drawdown" className="col-span-2">
            <Input inputMode="decimal" className="num" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
          <button type="button" onClick={() => finish(true)} className="text-sm text-muted underline-offset-4 transition hover:text-fg hover:underline">
            Explore with test data first
          </button>
          <Button variant="primary" type="submit">Start journaling</Button>
        </div>
      </form>
    </Modal>
  );
}
