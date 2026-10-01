'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight, BookOpen, BrainCircuit, CalendarDays, FileBarChart, LayoutDashboard,
  LibraryBig, LifeBuoy, Moon, Settings, Sun,
} from 'lucide-react';
import { useJournal, type SaveStatus } from '@/store/JournalProvider';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/ui/Logo';
import { AccountSwitcher } from './AccountSwitcher';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/playbook', label: 'The Playbook', icon: BookOpen },
  { href: '/trades', label: 'Trades', icon: ArrowLeftRight },
  { href: '/insights', label: 'AI Insights & Signals', icon: BrainCircuit },
  { href: '/resources', label: 'Resources', icon: LibraryBig },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/reports', label: 'Reports', icon: FileBarChart },
];

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved to disk',
  saving: 'Saving…',
  browser: 'Saved in browser',
  error: 'Save failed',
};

export function Sidebar() {
  const pathname = usePathname();
  const { data, actions, saveStatus } = useJournal();
  const online = useOnlineStatus();
  const theme = data.settings.theme;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-5">
        <LogoMark />
        <span className="text-[15px] font-semibold tracking-tight text-fg">Sniper Journal</span>
      </div>

      <div className="px-3 pt-4">
        <AccountSwitcher variant="card" />
      </div>

      <nav className="mt-5 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition',
                active ? 'bg-accent/10 font-medium text-fg' : 'text-muted hover:bg-raised hover:text-fg',
              )}
            >
              {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-accent" />}
              <Icon className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-faint group-hover:text-muted')} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-line p-3">
        <Link
          href="/settings"
          className={cn(
            'flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition',
            isActive('/settings') ? 'bg-accent/10 font-medium text-fg' : 'text-muted hover:bg-raised hover:text-fg',
          )}
        >
          <Settings className={cn('size-4', isActive('/settings') ? 'text-accent' : 'text-faint')} />
          Settings
        </Link>

        <div className="grid grid-cols-2 rounded-lg border border-line bg-app p-0.5" role="group" aria-label="Color theme">
          {(['dark', 'light'] as const).map((mode) => {
            const Icon = mode === 'dark' ? Moon : Sun;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={theme === mode}
                onClick={() => actions.updateSettings({ theme: mode })}
                className={cn(
                  'flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium capitalize transition',
                  theme === mode ? 'bg-raised text-fg ring-1 ring-line-strong/60' : 'text-muted hover:text-fg',
                )}
              >
                <Icon className="size-3.5" />
                {mode}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-1 text-xs">
          <span className="flex items-center gap-2 text-muted">
            <span
              className={cn('size-2 rounded-full', online ? 'bg-profit' : 'bg-faint')}
              style={online ? { boxShadow: '0 0 0 3px color-mix(in srgb, var(--profit) 20%, transparent)' } : undefined}
            />
            {online ? 'Online' : 'Offline'}
          </span>
          <span className={cn(saveStatus === 'error' ? 'text-loss' : 'text-faint')} title="Where your journal is stored">
            {SAVE_LABEL[saveStatus]}
          </span>
        </div>
      </div>
    </aside>
  );
}
