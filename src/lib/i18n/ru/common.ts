import type { common as en } from '../en/common';
import type { Translation } from '../types';

export const common: Translation<typeof en> = {
  'common.cancel': 'Отмена',
  'common.confirm': 'Подтвердить',
  'common.ok': 'ОК',
  'common.close': 'Закрыть',
  'common.save': 'Сохранить',
  'common.add': 'Добавить',
  'common.edit': 'Изменить',
  'common.delete': 'Удалить',
  'common.optional': 'необязательно',
  'common.trades': { one: '{count} сделка', few: '{count} сделки', many: '{count} сделок', other: '{count} сделки' },
  'common.keptHere': 'Ваш журнал хранится здесь:',
  'common.downloadBackup': 'Скачать резервную копию',
  'common.backUpJournal': 'Сохранить резервную копию',
  'common.backupDownloaded': 'Резервная копия скачана',
  'common.yourName': 'Ваше имя',
  'common.namePlaceholder': 'Показывается в шапке',
  'common.currency': 'Валюта',
  'common.language': 'Язык',
  'common.accountName': 'Название счёта',
  'common.startingBalance': 'Начальный баланс',
  'common.accountPlaceholder': 'например, челлендж проп-фирмы',
  'common.accountCreated': 'Счёт «{name}» создан',
  'common.removeTestData.title': 'Удалить тестовые данные?',
  'common.removeTestData.message': {
    one: 'Будет удалена {count} сгенерированная тестовая сделка, все прикреплённые к ней изображения графиков и тестовые сетапы плейбука. Сделки, которые вы ввели сами, останутся.',
    few: 'Будут удалены {count} сгенерированные тестовые сделки, все прикреплённые к ним изображения графиков и тестовые сетапы плейбука. Сделки, которые вы ввели сами, останутся.',
    many: 'Будут удалены {count} сгенерированных тестовых сделок, все прикреплённые к ним изображения графиков и тестовые сетапы плейбука. Сделки, которые вы ввели сами, останутся.',
    other:
      'Будут удалены {count} сгенерированные тестовые сделки, все прикреплённые к ним изображения графиков и тестовые сетапы плейбука. Сделки, которые вы ввели сами, останутся.',
  },
  'common.removeTestData.confirm': 'Удалить тестовые данные',
  'common.testDataRemoved': 'Тестовые данные удалены',
};
