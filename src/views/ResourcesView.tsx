'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, LibraryBig, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Resource } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { uid } from '@/lib/utils';
import { tr } from '@/lib/i18n';
import { safeLink } from '@/store/sanitize';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

/** saved on a resource in English whatever the language; see categoryName */
const CATEGORIES = ['Charting', 'News & data', 'Education', 'Broker', 'Tools', 'Reading', 'Other'] as const;
type Category = (typeof CATEGORIES)[number];

/** a category as the screen names it: one of CATEGORIES in the current language, any other as it is */
const categoryName = (category: string) =>
  (CATEGORIES as readonly string[]).includes(category) ? tr(`res.cat.${category as Category}`) : category;

export function ResourcesView() {
  const { data, actions } = useJournal();
  const { confirm, toast } = useUI();
  const [editing, setEditing] = useState<Resource | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of data.resources) map.set(r.category, [...(map.get(r.category) ?? []), r]);
    // in the order of the names shown, which in English are the names saved
    return [...map.entries()].sort((a, b) => categoryName(a[0]).localeCompare(categoryName(b[0])));
  }, [data.resources]);

  const blank = (): Resource => ({
    id: uid(),
    title: '',
    url: '',
    category: CATEGORIES[0],
    notes: '',
    createdAt: new Date().toISOString(),
  });

  const remove = async (resource: Resource) => {
    const ok = await confirm({
      title: tr('res.remove.title', { name: resource.title }),
      message: tr('res.remove.message'),
      confirmLabel: tr('shell.remove'),
      tone: 'danger',
    });
    if (ok) {
      actions.deleteResource(resource.id);
      toast(tr('res.removed'));
    }
  };

  return (
    <>
      <PageHeader
        title={tr('nav.resources')}
        description={tr('res.description')}
        actions={
          <Button variant="primary" onClick={() => setEditing(blank())}>
            <Plus className="size-4" /> {tr('res.add')}
          </Button>
        }
      />

      {data.resources.length === 0 ? (
        <EmptyState
          icon={LibraryBig}
          title={tr('res.empty.title')}
          description={tr('res.empty.text')}
          actions={
            <Button variant="primary" onClick={() => setEditing(blank())}>
              <Plus className="size-4" /> {tr('res.empty.first')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-2.5 text-sm font-semibold text-fg">{categoryName(category)}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {items.map((r) => (
                  <article key={r.id} className="group flex flex-col rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-start gap-2">
                      <h3 dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                        {r.title}
                      </h3>
                      {/* a phone has no hover to reveal them, so they are always there */}
                      <div className="-my-2 flex shrink-0 gap-0.5 transition md:my-0 md:opacity-0 md:group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing(r)}
                          aria-label={tr('pb.editNamed', { name: r.title })}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="hover:bg-loss/10 hover:text-loss"
                          onClick={() => remove(r)}
                          aria-label={tr('res.removeNamed', { name: r.title })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    {r.notes && (
                      <p dir="auto" className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">
                        {r.notes}
                      </p>
                    )}
                    {/* only ever an http(s) link: a javascript: one would run inside the app */}
                    {safeLink(r.url) && (
                      <a
                        href={safeLink(r.url)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-3 inline-flex items-center gap-1.5 truncate text-xs text-accent underline-offset-4 hover:underline"
                      >
                        <ExternalLink className="size-3.5 shrink-0" />
                        <span dir="auto" className="truncate">
                          {r.url?.replace(/^https?:\/\//, '')}
                        </span>
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          closeOnBackdrop={false}
          size="md"
          title={editing.title ? tr('res.edit') : tr('res.add')}
        >
          <ResourceForm
            resource={editing}
            onCancel={() => setEditing(null)}
            onSave={(next) => {
              actions.upsertResource(next);
              setEditing(null);
              toast(tr('res.saved'));
            }}
          />
        </Modal>
      )}
    </>
  );
}

function ResourceForm({
  resource,
  onSave,
  onCancel,
}: {
  resource: Resource;
  onSave: (r: Resource) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(resource);
  const [error, setError] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.title.trim()) {
          setError(tr('res.titleRequired'));
          return;
        }
        const url = draft.url?.trim();
        onSave({
          ...draft,
          title: draft.title.trim(),
          url: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : undefined,
        });
      }}
      className="space-y-4"
    >
      <Field label={tr('res.title')} error={error}>
        <Input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder={tr('goals.example', { n: 'TradingView' })}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
        <Field label={tr('res.link')} hint={tr('common.optional')}>
          <Input
            value={draft.url ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            placeholder="tradingview.com"
          />
        </Field>
        <Field label={tr('res.category')}>
          <Select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryName(c)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={tr('form.notes')} hint={tr('common.optional')}>
        <Textarea
          value={draft.notes ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder={tr('res.notesPlaceholder')}
        />
      </Field>
      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onCancel}>
          {tr('common.cancel')}
        </Button>
        <Button variant="primary" type="submit">
          {tr('common.save')}
        </Button>
      </div>
    </form>
  );
}
