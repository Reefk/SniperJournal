'use client';

import { useRouter } from 'next/navigation';
import { Download, LifeBuoy, Settings, User } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { exportBackup } from '@/lib/backup';
import { MenuDivider, MenuItem, Popover } from '@/components/ui/Popover';

export function ProfileMenu() {
  const { data } = useJournal();
  const { toast } = useUI();
  const router = useRouter();
  const name = data.profile.name.trim();
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Popover
      className="w-60"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Profile menu"
          className="ml-1 grid size-9 place-items-center rounded-full border border-line bg-raised text-xs font-semibold text-fg transition hover:border-line-strong"
        >
          {initials || <User className="size-4 text-muted" />}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2.5 py-2">
            <div className="truncate text-sm font-medium text-fg">{name || 'Trader'}</div>
            <div className="text-xs text-muted">Journal stored on this PC</div>
          </div>
          <MenuDivider />
          <MenuItem icon={Settings} onClick={() => { close(); router.push('/settings'); }}>Settings</MenuItem>
          <MenuItem icon={Download} onClick={() => { exportBackup(data); close(); toast('Backup downloaded'); }}>
            Download backup
          </MenuItem>
          <MenuItem icon={LifeBuoy} onClick={() => { close(); router.push('/support'); }}>Help & shortcuts</MenuItem>
        </div>
      )}
    </Popover>
  );
}
