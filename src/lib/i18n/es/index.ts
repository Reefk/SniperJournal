import type { Messages } from '../en';
import type { Translation } from '../types';
import { calendar } from './calendar';
import { common } from './common';
import { dashboard } from './dashboard';
import { format } from './format';
import { goals } from './goals';
import { importDialog } from './importDialog';
import { importer } from './importer';
import { insights } from './insights';
import { list } from './list';
import { platforms } from './platforms';
import { settings } from './settings';
import { shell } from './shell';
import { trade } from './trade';
import { ui } from './ui';

export const es: Translation<Messages> = {
  ...calendar,
  ...common,
  ...dashboard,
  ...format,
  ...goals,
  ...importDialog,
  ...importer,
  ...insights,
  ...list,
  ...platforms,
  ...settings,
  ...shell,
  ...trade,
  ...ui,
};
