'use client';

import { Clock } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useNow } from '@/hooks/useNow';
import { MenuItem, Popover } from '@/components/ui/Popover';

const ZONES = [
  { id: 'local', label: 'Local time', short: 'Local' },
  { id: 'America/New_York', label: 'New York', short: 'NY' },
  { id: 'Europe/London', label: 'London', short: 'LDN' },
  { id: 'Asia/Tokyo', label: 'Tokyo', short: 'TYO' },
  { id: 'UTC', label: 'UTC', short: 'UTC' },
];

function timeIn(zone: string, date: Date, seconds = true): string {
  if (date.getTime() === 0) return seconds ? '--:--:--' : '--:--';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hourCycle: 'h23',
    ...(zone === 'local' ? {} : { timeZone: zone }),
  }).format(date);
}

export function ClockDisplay() {
  const { data, actions } = useJournal();
  const now = useNow(1000);
  const zone = ZONES.find((z) => z.id === data.settings.timezone) ?? ZONES[0];

  return (
    <Popover
      className="w-60"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          title={zone.label}
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-app px-2.5 transition hover:border-line-strong"
        >
          <Clock className="size-3.5 text-faint" />
          <span className="num text-sm text-fg">{timeIn(zone.id, now)}</span>
          <span className="rounded bg-raised px-1.5 py-px text-[10px] font-semibold text-muted">{zone.short}</span>
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2.5 pb-1 pt-1.5 text-xs text-faint">Clock timezone</div>
          {ZONES.map((z) => (
            <MenuItem
              key={z.id}
              selected={z.id === zone.id}
              onClick={() => {
                actions.updateSettings({ timezone: z.id });
                close();
              }}
              trailing={<span className="num text-xs text-muted">{timeIn(z.id, now, false)}</span>}
            >
              {z.label}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
