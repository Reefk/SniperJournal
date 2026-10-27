import type { resources as en } from '../en/resources';
import type { Translation } from '../types';

export const resources: Translation<typeof en> = {
  'res.description': 'Tu propia selección de herramientas, fuentes y lecturas. No se añade nada por ti.',
  'res.add': 'Añadir recurso',
  'res.edit': 'Editar recurso',
  'res.empty.title': 'No hay recursos guardados',
  'res.empty.text':
    'Guarda en un solo sitio el puñado de enlaces que de verdad abres en cada sesión: tu plataforma de gráficos, tu calendario económico, la página de extractos de tu bróker, el libro que estás leyendo.',
  'res.empty.first': 'Añade tu primer recurso',
  'res.removeNamed': 'Quitar {name}',
  'res.remove.title': '¿Quitar «{name}»?',
  'res.remove.message': 'Esto solo quita el enlace de tu lista de recursos.',
  'res.removed': 'Recurso quitado',
  'res.saved': 'Recurso guardado',

  'res.titleRequired': 'Ponle un título',
  'res.title': 'Título',
  'res.link': 'Enlace',
  'res.category': 'Categoría',
  'res.notesPlaceholder': 'Para qué lo usas',

  'res.cat.Charting': 'Gráficos',
  'res.cat.News & data': 'Noticias y datos',
  'res.cat.Education': 'Formación',
  'res.cat.Broker': 'Bróker',
  'res.cat.Tools': 'Herramientas',
  'res.cat.Reading': 'Lectura',
  'res.cat.Other': 'Otros',
};
