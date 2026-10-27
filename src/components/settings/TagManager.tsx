'use client';

import { useMemo, useState } from 'react';
import { CircleAlert, Ellipsis, Merge, Pencil, Plus, Trash2 } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { formatMoney } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { matchMistake, mistakeList, mistakeName } from '@/lib/mistakes';
import {
  keepApart,
  likelyMistake,
  lookAlikes,
  saveGroup,
  spacedTag,
  tagLines,
  tradesWith,
  type TagChange,
  type TagLine,
} from '@/lib/tags';
import type { TagGroup } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { MenuDivider, MenuItem, Popover } from '@/components/ui/Popover';

/** below this many tags the list shows them all; above it, a search box and "Show all" */
const SHORT_LIST = 12;

type Asking = { kind: 'rename' | 'merge' | 'move'; tags: string[] };

/**
 * Settings → Tags: every tag in the journal, in every account, with what it
 * made; rename, merge, delete or move one to the mistakes on every trade at
 * once; look-alikes listed to merge or keep apart; and my own tag groups.
 */
export function TagManager() {
  const { data, actions } = useJournal();
  const { confirm, toast } = useUI();
  const currency = data.settings.currency;
  const groups = useMemo(() => data.settings.tagGroups ?? [], [data.settings.tagGroups]);
  const lines = useMemo(() => tagLines(data.trades, groups), [data.trades, groups]);
  const alike = useMemo(
    () =>
      lookAlikes(
        lines.map((l) => l.tag),
        data.settings.tagsKeptApart,
      ),
    [lines, data.settings.tagsKeptApart],
  );
  const used = useMemo(() => new Map(lines.map((l) => [l.tag, l.trades])), [lines]);
  const [asking, setAsking] = useState<Asking | null>(null);
  // undefined: no group open; null: a new one
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);
  const [find, setFind] = useState('');

  const term = find.trim().toLowerCase();
  const found = term ? lines.filter((l) => l.tag.toLowerCase().includes(term)) : lines;
  const shown = term || showAll ? found : found.slice(0, SHORT_LIST);

  const apply = (change: TagChange, message: string) => {
    actions.changeTags(change);
    setAsking(null);
    toast(message);
  };

  const remove = async (tag: string) => {
    const n = tradesWith(data.trades, [tag]);
    const ok = await confirm({
      title: tr('tags.delete.title', { tag }),
      message: tr('tags.delete.message', { count: n }),
      confirmLabel: tr('tags.delete.confirm'),
      tone: 'danger',
    });
    if (ok) apply({ from: [tag], into: null }, tr('tags.deleted', { tag, count: n }));
  };

  if (!lines.length && !groups.length) {
    return <p className="text-sm text-muted">{tr('tags.none')}</p>;
  }

  return (
    <div className="space-y-4">
      {alike.length > 0 && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
          <div className="pt-1 text-sm font-medium text-fg">{tr('tags.alike')}</div>
          <ul className="divide-y divide-line">
            {alike.map((set) => (
              <li key={set.join('\n')} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="flex min-w-0 flex-wrap gap-1.5">
                  {set.map((tag) => (
                    <span
                      key={tag}
                      className="whitespace-pre rounded-md border border-line bg-app px-2 py-0.5 text-xs text-fg"
                    >
                      {tag} <span className="text-faint">{used.get(tag)}×</span>
                    </span>
                  ))}
                </span>
                <span className="ms-auto flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => setAsking({ kind: 'merge', tags: set })}>
                    <Merge className="size-3.5" /> {tr('tags.merge')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAsking({ kind: 'move', tags: set })}>
                    {tr('tags.moveToMistakes')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      actions.updateSettings({ tagsKeptApart: keepApart(data.settings, set) });
                      toast(tr('tags.keptApart'));
                    }}
                  >
                    {tr('tags.keepApart')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lines.length > 0 && (
        <div>
          {lines.length > SHORT_LIST && (
            <Input
              aria-label={tr('tags.find')}
              placeholder={tr('tags.find')}
              value={find}
              onChange={(e) => setFind(e.target.value)}
              className="mb-2 md:max-w-xs"
            />
          )}
          <ul className="divide-y divide-line" aria-label={tr('tags.yours')}>
            {shown.map((line) => (
              <TagRow
                key={line.tag}
                line={line}
                currency={currency}
                onAsk={(kind) => setAsking({ kind, tags: [line.tag] })}
                onDelete={() => void remove(line.tag)}
              />
            ))}
          </ul>
          {term && !found.length && (
            <p className="py-2 text-sm text-muted">{tr('tags.noMatch', { text: find.trim() })}</p>
          )}
          {!term && found.length > SHORT_LIST && (
            <Button size="sm" variant="ghost" className="mt-1" onClick={() => setShowAll((s) => !s)}>
              {showAll ? tr('tags.showFewer') : tr('tags.showAll', { count: found.length })}
            </Button>
          )}
        </div>
      )}

      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-fg">{tr('tags.groups')}</h3>
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus className="size-3.5" /> {tr('tags.newGroup')}
          </Button>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{tr('tags.groupsHint')}</p>
        {groups.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {groups.map((g) => (
              <li key={g.name} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-fg">{g.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.tags.length ? (
                      g.tags.map((tag) => (
                        <span
                          key={tag}
                          className="whitespace-pre rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-faint">{tr('tags.groupEmpty')}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(g.name)}
                  aria-label={tr('tags.editGroup', { name: g.name })}
                >
                  <Pencil className="size-3.5" /> {tr('common.edit')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {asking && (
        <TagDialog
          asking={asking}
          lines={lines}
          count={tradesWith(data.trades, asking.tags)}
          mistakes={mistakeList(data.settings)}
          onClose={() => setAsking(null)}
          onApply={apply}
        />
      )}
      {editing !== undefined && (
        <GroupEditor
          was={editing}
          groups={groups}
          lines={lines}
          onClose={() => setEditing(undefined)}
          onSave={(next, message) => {
            actions.updateSettings({ tagGroups: next });
            setEditing(undefined);
            toast(message);
          }}
          onDelete={async (name) => {
            const ok = await confirm({
              title: tr('tags.group.delete.title', { name }),
              message: tr('tags.group.delete.message'),
              confirmLabel: tr('tags.group.delete'),
              tone: 'danger',
            });
            if (!ok) return;
            actions.updateSettings({ tagGroups: groups.filter((g) => g.name !== name) });
            setEditing(undefined);
            toast(tr('tags.group.deleted'));
          }}
        />
      )}
    </div>
  );
}

function TagRow({
  line,
  currency,
  onAsk,
  onDelete,
}: {
  line: TagLine;
  currency: string;
  onAsk: (kind: Asking['kind']) => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div dir="auto" className="truncate whitespace-pre text-sm text-fg">
          {line.tag}
        </div>
        <div className="text-xs text-muted">
          {tr('common.trades', { count: line.trades })}
          {line.group && <> · {line.group}</>}
        </div>
      </div>
      <span
        className={cn(
          'num text-sm',
          !line.counted ? 'text-faint' : line.net > 0 ? 'text-profit' : line.net < 0 ? 'text-loss' : 'text-muted',
        )}
      >
        {line.counted ? formatMoney(line.net, currency, { sign: true, compact: true }) : '—'}
      </span>
      <Popover
        className="w-56"
        trigger={({ toggle, open }) => (
          <Button
            size="icon"
            variant="ghost"
            onClick={toggle}
            aria-expanded={open}
            aria-label={tr('tags.change', { tag: line.tag })}
          >
            <Ellipsis className="size-4" />
          </Button>
        )}
      >
        {(close) => (
          <div>
            {(
              [
                ['rename', Pencil, 'tags.rename'],
                ['merge', Merge, 'tags.mergeInto'],
                ['move', CircleAlert, 'tags.moveToMistakes'],
              ] as const
            ).map(([kind, icon, label]) => (
              <MenuItem
                key={kind}
                icon={icon}
                onClick={() => {
                  close();
                  onAsk(kind);
                }}
              >
                {tr(label)}
              </MenuItem>
            ))}
            <MenuDivider />
            <MenuItem
              icon={Trash2}
              danger
              onClick={() => {
                close();
                onDelete();
              }}
            >
              {tr('tags.delete')}
            </MenuItem>
          </div>
        )}
      </Popover>
    </li>
  );
}

/** Rename, Merge into… and Move to mistakes, each saying how many trades change before anything does */
function TagDialog({
  asking: { kind, tags },
  lines,
  count,
  mistakes,
  onClose,
  onApply,
}: {
  asking: Asking;
  lines: TagLine[];
  count: number;
  mistakes: string[];
  onClose: () => void;
  onApply: (change: TagChange, message: string) => void;
}) {
  const [first] = tags;
  const others = lines.filter((l) => !tags.includes(l.tag));
  const [name, setName] = useState(kind === 'rename' ? first : '');
  // merge: of a look-alike set, the spelling kept; of one tag, the tag it goes into
  const [into, setInto] = useState(tags.length > 1 ? first : (others[0]?.tag ?? ''));
  // the mistake picked, by its place in the list; -1 for a new one
  const [pick, setPick] = useState(() => mistakes.indexOf(likelyMistake(tags, mistakes) ?? ''));
  const [newMistake, setNewMistake] = useState(() => spacedTag(first));

  let title: string;
  let body: React.ReactNode;
  let action: string;
  let change: TagChange | null;
  let message = '';

  if (kind === 'rename') {
    const to = spacedTag(name);
    const merging = to !== first && lines.some((l) => l.tag === to);
    title = tr('tags.rename.title', { tag: first });
    action = merging ? tr('tags.merge.action') : tr('tags.rename.action');
    change = to && to !== first ? { from: [first], into: to } : null;
    message = merging ? tr('tags.merge.done', { tag: to, count }) : tr('tags.rename.done', { count });
    body = (
      <Field label={tr('tags.rename.newName')}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {merging ? tr('tags.rename.mergeHint', { tag: to, count }) : tr('tags.rename.hint', { count })}
        </p>
      </Field>
    );
  } else if (kind === 'merge') {
    title = tags.length > 1 ? tr('tags.merge.titleMany') : tr('tags.merge.title', { tag: first });
    action = tr('tags.merge.action');
    change = into ? { from: tags, into } : null;
    message = tr('tags.merge.done', { tag: into, count });
    body =
      tags.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">{tr('tags.merge.keep')}</legend>
          <div className="space-y-1.5">
            {tags.map((tag) => (
              <label key={tag} className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
                <input
                  type="radio"
                  name="kept"
                  checked={into === tag}
                  onChange={() => setInto(tag)}
                  className="size-4"
                />
                <span className="whitespace-pre">{tag}</span>
                <span className="text-xs text-faint">{lines.find((l) => l.tag === tag)?.trades}×</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{tr('tags.merge.become', { count })}</p>
        </fieldset>
      ) : others.length ? (
        <Field label={tr('tags.merge.into')}>
          <Select value={into} onChange={(e) => setInto(e.target.value)}>
            {others.map((l) => (
              <option key={l.tag} value={l.tag}>
                {l.tag} ({l.trades})
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs leading-relaxed text-muted">{tr('tags.merge.intoHint', { tag: first, count })}</p>
        </Field>
      ) : (
        <p className="text-sm text-muted">{tr('tags.merge.noOther')}</p>
      );
  } else {
    const typed = pick < 0 ? matchMistake(newMistake, mistakes) : mistakes[pick];
    title = tr('tags.move.title');
    action = tr('tags.move.title');
    change = typed ? { from: tags, into: null, mistake: typed } : null;
    message = tr('tags.move.done', { mistake: mistakeName(typed ?? ''), count });
    body = (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted">
          {tags.length > 1 ? tr('tags.move.bodyMany', { count }) : tr('tags.move.body', { tag: first, count })}
        </p>
        <Field label={tr('tags.move.mistake')}>
          <Select value={pick} onChange={(e) => setPick(Number(e.target.value))}>
            {mistakes.map((m, i) => (
              <option key={m} value={i}>
                {mistakeName(m)}
              </option>
            ))}
            <option value={-1}>{tr('tags.move.newMistake')}</option>
          </Select>
        </Field>
        {pick < 0 && (
          <Field label={tr('tags.move.name')} hint={tr('tags.move.nameHint')}>
            <Input value={newMistake} onChange={(e) => setNewMistake(e.target.value)} />
          </Field>
        )}
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop={false}
      size="sm"
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!change} onClick={() => change && onApply(change, message)}>
            {action}
          </Button>
        </div>
      }
    >
      {body}
    </Modal>
  );
}

/** A group: its name, and which tags are in it (a tag in another group moves here) */
function GroupEditor({
  was,
  groups,
  lines,
  onClose,
  onSave,
  onDelete,
}: {
  was: string | null;
  groups: TagGroup[];
  lines: TagLine[];
  onClose: () => void;
  onSave: (groups: TagGroup[], message: string) => void;
  onDelete: (name: string) => void;
}) {
  const own = groups.find((g) => g.name === was);
  const [name, setName] = useState(was ?? '');
  const [chosen, setChosen] = useState<string[]>(own?.tags ?? []);
  const [error, setError] = useState<string>();
  // its own tags first, in their order (one no trade has any more too, to untick), then the rest by use
  const listed = [...(own?.tags ?? []), ...lines.map((l) => l.tag).filter((tag) => !own?.tags.includes(tag))];
  const unused = (tag: string) => !lines.some((l) => l.tag === tag);
  const elsewhere = (tag: string) => groups.find((g) => g.name !== was && g.tags.includes(tag))?.name;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError(tr('tags.group.nameIt'));
    if (groups.some((g) => g.name !== was && g.name.toLowerCase() === trimmed.toLowerCase()))
      return setError(tr('tags.group.taken'));
    onSave(
      saveGroup(groups, was, { name: trimmed, tags: chosen }),
      was == null ? tr('tags.group.made') : tr('tags.group.saved'),
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop={false}
      size="md"
      title={was == null ? tr('tags.newGroup') : tr('tags.group.edit', { name: was })}
      description={tr('tags.group.hint')}
      footer={
        <div className="flex items-center gap-2">
          {was != null && (
            <Button variant="danger" onClick={() => onDelete(was)}>
              <Trash2 className="size-3.5" /> {tr('tags.group.delete')}
            </Button>
          )}
          <div className="ms-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {tr('common.cancel')}
            </Button>
            <Button variant="primary" onClick={save}>
              {tr('tags.group.save')}
            </Button>
          </div>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <Field label={tr('tags.group.name')} error={error}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
            placeholder={tr('tags.group.namePlaceholder')}
            autoFocus={was == null}
          />
        </Field>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">{tr('tags.group.tags')}</legend>
          {listed.length ? (
            <div className="grid gap-1 sm:grid-cols-2">
              {listed.map((tag) => (
                <label
                  key={tag}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm text-fg"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0"
                    checked={chosen.includes(tag)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, tag] : c.filter((t) => t !== tag)))}
                  />
                  <span dir="auto" className="min-w-0 truncate whitespace-pre">
                    {tag}
                  </span>
                  {elsewhere(tag) && (
                    <span className="shrink-0 text-xs text-faint">
                      {tr('tags.group.inOther', { name: elsewhere(tag) ?? '' })}
                    </span>
                  )}
                  {unused(tag) && <span className="shrink-0 text-xs text-faint">{tr('tags.group.unused')}</span>}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{tr('tags.group.noTags')}</p>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
