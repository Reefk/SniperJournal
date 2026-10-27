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
import { playbook } from './playbook';
import { resources } from './resources';
import { settings } from './settings';
import { shell } from './shell';
import { support } from './support';
import { trade } from './trade';
import { ui } from './ui';

export const ru: Translation<Messages> = {
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
  ...playbook,
  ...resources,
  ...settings,
  ...shell,
  ...support,
  ...trade,
  ...ui,
};
