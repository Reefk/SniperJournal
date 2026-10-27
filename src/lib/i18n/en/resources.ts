import type { Message } from '../types';

/** the Resources page and its form */
export const resources = {
  'res.description': 'Your own shortlist of tools, feeds and reading. Nothing is added for you.',
  'res.add': 'Add resource',
  'res.edit': 'Edit resource',
  'res.empty.title': 'No resources saved',
  'res.empty.text':
    'Keep the handful of links you actually open every session in one place: your charting platform, your economic calendar, the broker statement page, a book you are working through.',
  'res.empty.first': 'Add your first resource',
  'res.removeNamed': 'Remove {name}',
  'res.remove.title': 'Remove "{name}"?',
  'res.remove.message': 'This only removes the link from your resources list.',
  'res.removed': 'Resource removed',
  'res.saved': 'Resource saved',

  'res.titleRequired': 'Give it a title',
  'res.title': 'Title',
  'res.link': 'Link',
  'res.category': 'Category',
  'res.notesPlaceholder': 'What you use it for',

  // what a resource's category is saved as stays in English; this is how a screen names it
  'res.cat.Charting': 'Charting',
  'res.cat.News & data': 'News & data',
  'res.cat.Education': 'Education',
  'res.cat.Broker': 'Broker',
  'res.cat.Tools': 'Tools',
  'res.cat.Reading': 'Reading',
  'res.cat.Other': 'Other',
} satisfies Record<string, Message>;
