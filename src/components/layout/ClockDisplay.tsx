'use client';

import { Clock } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useNow } from '@/hooks/useNow';
import { MenuItem, Popover } from '@/components/ui/Popover';
import { tr, type MessageKey } from '@/lib/i18n';

/** a zone's name, and its short name: a key to translate, or one that reads the same in every language */
const ZONES: Array<{ id: string; label: MessageKey | 'UTC'; short: MessageKey | 'NY' | 'LDN' | 'TYO' | 'UTC' }> = [
  { id: 'local', label: 'clock.local', short: 'clock.localShort' },
  { id: 'America/New_York', label: 'clock.newYork', short: 'NY' },
  { id: 'Europe/London', label: 'clock.london', short: 'LDN' },
  { id: 'Asia/Tokyo', label: 'clock.tokyo', short: 'TYO' },
  { id: 'UTC', label: 'UTC', short: 'UTC' },
];

const named = (name: string) => (name.startsWith('clock.') ? tr(name as MessageKey) : name);

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
          title={named(zone.label)}
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-app px-2.5 transition hover:border-line-strong"
        >
          <Clock className="size-3.5 text-faint" />
          <span className="num text-sm text-fg">{timeIn(zone.id, now)}</span>
          <span className="rounded bg-raised px-1.5 py-px text-[10px] font-semibold text-muted">
            {named(zone.short)}
          </span>
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2.5 pb-1 pt-1.5 text-xs text-faint">{tr('clock.heading')}</div>
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
              {named(z.label)}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
