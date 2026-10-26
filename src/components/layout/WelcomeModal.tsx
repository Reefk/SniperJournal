'use client';

import { useState } from 'react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { CURRENCIES } from '@/lib/format';
import { toNumberOrNull } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { CAN_BRING_OVER, useBringOver } from '@/hooks/useBringOver';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { LogoMark } from '@/components/ui/Logo';
import { rich } from '@/components/ui/Rich';
import { LanguageSelect } from '@/components/settings/LanguageSelect';
import { tr } from '@/lib/i18n';

/** First run. Nothing is assumed: the journal starts empty. */
export function WelcomeModal() {
  const { data, actions } = useJournal();
  const { toast } = useUI();
  const [name, setName] = useState('');
  // a language chosen here draws the dialog again, in it, with this name in it too
  const [accountName, setAccountName] = useState(() => tr('welcome.defaultAccount'));
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const bringOver = useBringOver();

  if (data.onboarded) return null;

  const finish = (withSample: boolean) => {
    actions.completeOnboarding({
      name: name.trim(),
      accountName: accountName.trim() || tr('welcome.defaultAccount'),
      startingBalance: toNumberOrNull(balance) ?? 0,
      currency,
    });
    if (withSample) {
      actions.loadSampleData();
      toast(tr('welcome.sampleLoaded'), 'info');
    }
  };

  return (
    <Modal open onClose={() => undefined} size="md" closeOnBackdrop={false} phone="full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          finish(false);
        }}
      >
        <div className="flex items-center gap-3 pb-1 pt-2">
          <LogoMark size={40} />
          <div>
            <h2 className="text-lg font-semibold text-fg">{tr('welcome.title')}</h2>
            <p className="text-sm text-muted">
              {storage.device === 'phone' ? tr('welcome.savedPhone') : tr('welcome.savedPc')}
            </p>
          </div>
        </div>

        {storage.device === 'phone' && (
          // the one thing a phone does differently that can cost you your journal
          <p className="mt-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-xs leading-relaxed text-fg">
            {rich(tr('welcome.phoneWarning'), { b: (text) => <span className="font-medium">{text}</span> })}
          </p>
        )}

        {CAN_BRING_OVER && (
          <p className="mt-4 rounded-lg border border-line bg-app px-3 py-2.5 text-xs leading-relaxed text-muted">
            {rich(tr('welcome.bringOver'), {
              link: (text) => (
                <button
                  type="button"
                  onClick={() => void bringOver()}
                  className="font-medium text-accent underline-offset-4 hover:underline"
                >
                  {text}
                </button>
              ),
            })}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label={tr('common.language')} className="col-span-2">
            <LanguageSelect />
          </Field>
          <Field label={tr('common.yourName')} hint={tr('common.optional')} className="col-span-2">
            <Input
              autoFocus={storage.device === 'pc'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr('common.namePlaceholder')}
            />
          </Field>
          <Field label={tr('common.accountName')}>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </Field>
          <Field label={tr('common.currency')}>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tr('common.startingBalance')} hint={tr('welcome.balanceHint')} className="col-span-2">
            <Input
              inputMode="decimal"
              className="num"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => finish(true)}
            className="text-sm text-muted underline-offset-4 transition hover:text-fg hover:underline"
          >
            {tr('welcome.explore')}
          </button>
          <Button variant="primary" type="submit">
            {tr('welcome.start')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
