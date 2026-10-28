import type { Messages } from '../en';
import type { Translation } from '../types';
import { calendar } from './calendar';
import { common } from './common';
import { dashboard } from './dashboard';
import { files } from './files';
import { format } from './format';
import { goals } from './goals';
import { importDialog } from './importDialog';
import { importer } from './importer';
import { insights } from './insights';
import { list } from './list';
import { platforms } from './platforms';
import { playbook } from './playbook';
import { reports } from './reports';
import { resources } from './resources';
import { sample } from './sample';
import { settings } from './settings';
import { shell } from './shell';
import { support } from './support';
import { trade } from './trade';
import { ui } from './ui';

export const ar: Translation<Messages> = {
  ...calendar,
  ...common,
  ...dashboard,
  ...files,
  ...format,
  ...goals,
  ...importDialog,
  ...importer,
  ...insights,
  ...list,
  ...platforms,
  ...playbook,
  ...reports,
  ...resources,
  ...sample,
  ...settings,
  ...shell,
  ...support,
  ...trade,
  ...ui,
};
