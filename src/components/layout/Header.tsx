'use client';

import { Plus } from 'lucide-react';
import { useUI } from '@/store/UIProvider';
import { Button } from '@/components/ui/Button';
import { GlobalSearch } from './GlobalSearch';
import { AccountSwitcher } from './AccountSwitcher';
import { ClockDisplay } from './ClockDisplay';
import { ProfileMenu } from './ProfileMenu';

export function Header() {
  const { openTradeForm } = useUI();
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2">
        <Button variant="primary" onClick={() => openTradeForm()} title="Log a trade (N)">
          <Plus className="size-4" />
          Log trade
          <kbd className="num ml-0.5 rounded bg-white/15 px-1.5 py-px text-[10px] font-medium">N</kbd>
        </Button>
        <div className="mx-2 h-6 w-px bg-line" />
        <AccountSwitcher variant="pill" />
        <ClockDisplay />
        <ProfileMenu />
      </div>
    </header>
  );
}
