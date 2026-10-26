import type { Messages } from '../en';
import type { Translation } from '../types';
import { common } from './common';
import { dashboard } from './dashboard';
import { format } from './format';
import { goals } from './goals';
import { list } from './list';
import { settings } from './settings';
import { shell } from './shell';
import { trade } from './trade';
import { ui } from './ui';

export const es: Translation<Messages> = {
  ...common,
  ...dashboard,
  ...format,
  ...goals,
  ...list,
  ...settings,
  ...shell,
  ...trade,
  ...ui,
};
