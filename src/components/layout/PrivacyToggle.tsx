'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n';

/** privacy mode on or off: every amount reads •••, for a screenshot that shows no money */
export function PrivacyToggle({ className }: { className?: string }) {
  const { data, actions } = useJournal();
  const hidden = data.settings.hideMoney === true;
  const Icon = hidden ? EyeOff : Eye;
  return (
    <Button
      size="icon"
      variant="ghost"
      className={className}
      aria-label={tr('header.hideMoney')}
      aria-pressed={hidden}
      title={hidden ? tr('header.moneyHidden') : tr('header.hideMoneyTitle')}
      onClick={() => actions.updateSettings({ hideMoney: !hidden })}
    >
      <Icon className="size-5 md:size-4" />
    </Button>
  );
}
