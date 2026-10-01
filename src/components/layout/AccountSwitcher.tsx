'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronsUpDown, Layers, Plus, Settings2, Wallet } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { formatMoney } from '@/lib/format';
import { toNumberOrNull } from '@/lib/utils';
import { MenuDivider, MenuItem, Popover } from '@/components/ui/Popover';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export function AccountSwitcher({ variant }: { variant: 'card' | 'pill' }) {
  const { data, actions, balances, activeLabel } = useJournal();
  const { toast } = useUI();
  const [creating, setCreating] = useState(false);
  const currency = data.settings.currency;
  const isAll = data.activeAccountId === 'all';
  const activeBalance = isAll
    ? Object.values(balances).reduce((a, b) => a + b, 0)
    : balances[data.activeAccountId] ?? 0;

  return (
    <>
      <Popover
        align={variant === 'card' ? 'start' : 'end'}
        className={variant === 'card' ? 'w-[224px]' : 'w-64'}
        trigger={({ toggle, open }) =>
          variant === 'card' ? (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex w-full items-center gap-3 rounded-lg border border-line bg-app px-3 py-2.5 text-left transition hover:border-line-strong"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-raised">
                {isAll ? <Layers className="size-4 text-accent" /> : <Wallet className="size-4 text-accent" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-fg">{activeLabel}</div>
                <div className="num truncate text-xs text-muted">{formatMoney(activeBalance, currency)}</div>
              </div>
              <ChevronsUpDown className="size-4 shrink-0 text-faint" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex h-9 items-center gap-2 rounded-md border border-line bg-app pl-2.5 pr-2 text-sm transition hover:border-line-strong"
            >
              <Wallet className="size-3.5 text-faint" />
              <span className="max-w-[160px] truncate text-fg">{activeLabel}</span>
              <ChevronsUpDown className="size-3.5 text-faint" />
            </button>
          )
        }
      >
        {(close) => (
          <div>
            <div className="px-2.5 pb-1 pt-1.5 text-xs text-faint">Accounts</div>
            {data.accounts.map((a) => (
              <MenuItem
                key={a.id}
                icon={Wallet}
                selected={data.activeAccountId === a.id}
                onClick={() => { actions.setActiveAccount(a.id); close(); }}
                trailing={<span className="num text-xs text-muted">{formatMoney(balances[a.id] ?? 0, currency, { compact: true })}</span>}
              >
                {a.name}
              </MenuItem>
            ))}
            {data.accounts.length > 1 && (
              <MenuItem icon={Layers} selected={isAll} onClick={() => { actions.setActiveAccount('all'); close(); }}>
                All accounts
              </MenuItem>
            )}
            <MenuDivider />
            <MenuItem icon={Plus} onClick={() => { close(); setCreating(true); }}>
              New account
            </MenuItem>
            <Link href="/settings" onClick={close} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg transition hover:bg-raised">
              <Settings2 className="size-4 text-muted" />
              Manage accounts
            </Link>
          </div>
        )}
      </Popover>

      <Modal open={creating} onClose={() => setCreating(false)} title="New account" size="sm">
        <NewAccountForm
          currency={currency}
          onCancel={() => setCreating(false)}
          onCreate={(name, balance) => {
            actions.addAccount(name, balance);
            setCreating(false);
            toast(`Account "${name}" created`);
          }}
        />
      </Modal>
    </>
  );
}

function NewAccountForm({ currency, onCreate, onCancel }: { currency: string; onCreate: (name: string, balance: number) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) { setError('Give the account a name'); return; }
        onCreate(name.trim(), toNumberOrNull(balance) ?? 0);
      }}
      className="space-y-4"
    >
      <Field label="Account name" error={error}>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prop firm challenge" />
      </Field>
      <Field label="Starting balance" hint={currency}>
        <Input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" className="num" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">Create account</Button>
      </div>
    </form>
  );
}
