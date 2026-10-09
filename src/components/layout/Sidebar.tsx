'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Download,
  FileBarChart,
  LayoutDashboard,
  LibraryBig,
  LifeBuoy,
  Menu,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { useJournal, type SaveStatus } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { exportBackup } from '@/lib/backup';
import { cn } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { LogoMark } from '@/components/ui/Logo';
import { Modal } from '@/components/ui/Modal';
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

const SAVE_LABEL: Record<SaveStatus, string> =
  storage.kind === 'native'
    ? { saved: 'Saved on this device', saving: 'Saving…', browser: 'Saved temporarily', error: 'Save failed' }
    : { saved: 'Saved to disk', saving: 'Saving…', browser: 'Saved in browser', error: 'Save failed' };

/** "online" means nothing to an app that never uses the network on a phone */
const SHOW_ONLINE = storage.kind === 'web';

export function Sidebar() {
  const pathname = usePathname();
  const { data, actions, saveStatus } = useJournal();
  const online = useOnlineStatus();
  const theme = data.settings.theme;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-surface md:flex">
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

        <div
          className="grid grid-cols-2 rounded-lg border border-line bg-app p-0.5"
          role="group"
          aria-label="Color theme"
        >
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
          {SHOW_ONLINE && (
            <span className="flex items-center gap-2 text-muted">
              <span
                className={cn('size-2 rounded-full', online ? 'bg-profit' : 'bg-faint')}
                style={
                  online ? { boxShadow: '0 0 0 3px color-mix(in srgb, var(--profit) 20%, transparent)' } : undefined
                }
              />
              {online ? 'Online' : 'Offline'}
            </span>
          )}
          <span
            className={cn(saveStatus === 'error' ? 'text-loss' : 'text-faint')}
            title="Where your journal is stored"
          >
            {SAVE_LABEL[saveStatus]}
          </span>
        </div>
      </div>
    </aside>
  );
}

/** the four pages a phone gets one tap away; everything else is behind More */
const TABS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Dashboard' },
  { href: '/trades', label: 'Trades' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/insights', label: 'Insights' },
];

const MORE = [
  ...NAV.filter((n) => !TABS.some((t) => t.href === n.href)),
  { href: '/settings', label: 'Settings', icon: Settings },
];

/** The phone's navigation: a tab bar at the bottom, with a sheet for the rest */
export function MobileNav() {
  const pathname = usePathname();
  const { data, actions, saveStatus } = useJournal();
  const { toast } = useUI();
  const [more, setMore] = useState(false);
  const theme = data.settings.theme;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const moreActive = MORE.some((m) => isActive(m.href));

  // however the page changes (a link here, the back button), the sheet goes with it
  const [sheetPath, setSheetPath] = useState(pathname);
  if (sheetPath !== pathname) {
    setSheetPath(pathname);
    setMore(false);
  }

  return (
    <>
      <nav aria-label="Main" className="flex shrink-0 border-t border-line bg-surface pb-safe md:hidden">
        {TABS.map(({ href, label }) => {
          const Icon = NAV.find((n) => n.href === href)?.icon ?? LayoutDashboard;
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition',
                active ? 'text-accent' : 'text-muted',
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-expanded={more}
          className={cn(
            'flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition',
            moreActive ? 'text-accent' : 'text-muted',
          )}
        >
          <Menu className="size-5" />
          More
        </button>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="More" size="sm">
        <div className="-mx-2 -mt-1">
          {MORE.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMore(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-12 items-center gap-3 rounded-md px-3 text-sm transition',
                  active ? 'bg-accent/10 font-medium text-fg' : 'text-fg hover:bg-raised',
                )}
              >
                <Icon className={cn('size-5', active ? 'text-accent' : 'text-muted')} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              exportBackup(data);
              setMore(false);
              if (storage.kind === 'web') toast('Backup downloaded');
            }}
            className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-fg transition hover:bg-raised"
          >
            <Download className="size-5 text-muted" />
            Back up your journal
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <div className="grid w-44 grid-cols-2 rounded-lg border border-line bg-app p-0.5" role="group" aria-label="Color theme">
            {(['dark', 'light'] as const).map((mode) => {
              const Icon = mode === 'dark' ? Moon : Sun;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={theme === mode}
                  onClick={() => actions.updateSettings({ theme: mode })}
                  className={cn(
                    'flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium capitalize transition',
                    theme === mode ? 'bg-raised text-fg ring-1 ring-line-strong/60' : 'text-muted hover:text-fg',
                  )}
                >
                  <Icon className="size-3.5" />
                  {mode}
                </button>
              );
            })}
          </div>
          <span className={cn('text-xs', saveStatus === 'error' ? 'text-loss' : 'text-faint')}>
            {SAVE_LABEL[saveStatus]}
          </span>
        </div>
      </Modal>
    </>
  );
}
