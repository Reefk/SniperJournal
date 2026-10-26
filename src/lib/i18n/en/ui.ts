import type { Message } from '../types';

/** the small pieces every screen is built from (components/ui) */
export const ui = {
  'common.open': 'Open',
  'common.removeTag': 'Remove tag {tag}',
  'common.tagPlaceholder': 'Type a tag and press Enter',
  'side.LONG': 'LONG',
  'side.SHORT': 'SHORT',
} satisfies Record<string, Message>;
