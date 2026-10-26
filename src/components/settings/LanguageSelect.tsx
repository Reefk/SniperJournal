'use client';

import { useJournal } from '@/store/JournalProvider';
import { LANGUAGES, isLanguage } from '@/lib/i18n';
import { Select } from '@/components/ui/Field';

/**
 * The app's language, each one named in its own language. English is kept
 * as no setting at all, as a journal that never chose one.
 */
export function LanguageSelect() {
  const { data, actions } = useJournal();
  return (
    <Select
      value={data.settings.language ?? 'en'}
      onChange={(e) => {
        const code = e.target.value;
        actions.updateSettings({ language: isLanguage(code) && code !== 'en' ? code : undefined });
      }}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} lang={l.code} dir={l.dir}>
          {l.name}
        </option>
      ))}
    </Select>
  );
}
