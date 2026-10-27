import type { resources as en } from '../en/resources';
import type { Translation } from '../types';

export const resources: Translation<typeof en> = {
  'res.description':
    'Ваш собственный короткий список инструментов, лент и материалов для чтения. Ничего не добавляется за вас.',
  'res.add': 'Добавить ресурс',
  'res.edit': 'Изменить ресурс',
  'res.empty.title': 'Сохранённых ресурсов нет',
  'res.empty.text':
    'Держите в одном месте те несколько ссылок, которые вы действительно открываете каждую сессию: платформу с графиками, экономический календарь, страницу с выписками брокера, книгу, которую сейчас изучаете.',
  'res.empty.first': 'Добавьте первый ресурс',
  'res.removeNamed': 'Удалить {name}',
  'res.remove.title': 'Удалить «{name}»?',
  'res.remove.message': 'Это удалит только ссылку из вашего списка ресурсов.',
  'res.removed': 'Ресурс удалён',
  'res.saved': 'Ресурс сохранён',

  'res.titleRequired': 'Дайте ему название',
  'res.title': 'Название',
  'res.link': 'Ссылка',
  'res.category': 'Категория',
  'res.notesPlaceholder': 'Для чего вы его используете',

  'res.cat.Charting': 'Графики',
  'res.cat.News & data': 'Новости и данные',
  'res.cat.Education': 'Обучение',
  'res.cat.Broker': 'Брокер',
  'res.cat.Tools': 'Инструменты',
  'res.cat.Reading': 'Чтение',
  'res.cat.Other': 'Другое',
};
