'use client';

import { Plus } from 'lucide-react';
import { useUI } from '@/store/UIProvider';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';
import { GlobalSearch } from './GlobalSearch';
import { AccountSwitcher } from './AccountSwitcher';
import { ClockDisplay } from './ClockDisplay';
import { ProfileMenu } from './ProfileMenu';

/**
 * PC:    [search box]                 [Log trade] | [account] [clock] [profile]
 * phone: [logo] [account]                     [search] [+] [profile]
 */
export function Header() {
  const { openTradeForm } = useUI();
  return (
    <header className="h-header relative z-30 flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 pt-safe md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <LogoMark />
        <AccountSwitcher variant="pill" align="start" />
      </div>
      <GlobalSearch />
      <div className="flex items-center gap-2 md:ml-auto">
        <Button
          variant="primary"
          onClick={() => openTradeForm()}
          title="Log a trade (N)"
          aria-label="Log a trade"
          className="max-md:size-10 max-md:px-0"
        >
          <Plus className="size-4" />
          <span className="max-md:hidden">Log trade</span>
          <kbd className="num ml-0.5 rounded bg-white/15 px-1.5 py-px text-[10px] font-medium max-md:hidden">N</kbd>
        </Button>
        <div className="mx-2 h-6 w-px bg-line max-md:hidden" />
        <div className="max-md:hidden">
          <AccountSwitcher variant="pill" />
        </div>
        <div className="max-md:hidden">
          <ClockDisplay />
        </div>
        <ProfileMenu />
      </div>
    </header>
  );
}
