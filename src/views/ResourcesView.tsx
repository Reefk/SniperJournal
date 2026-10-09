'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, LibraryBig, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Resource } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { uid } from '@/lib/utils';
import { safeLink } from '@/store/sanitize';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

const CATEGORIES = ['Charting', 'News & data', 'Education', 'Broker', 'Tools', 'Reading', 'Other'];

export function ResourcesView() {
  const { data, actions } = useJournal();
  const { confirm, toast } = useUI();
  const [editing, setEditing] = useState<Resource | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of data.resources) map.set(r.category, [...(map.get(r.category) ?? []), r]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
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
      title: `Remove "${resource.title}"?`,
      message: 'This only removes the link from your resources list.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) {
      actions.deleteResource(resource.id);
      toast('Resource removed');
    }
  };

  return (
    <>
      <PageHeader
        title="Resources"
        description="Your own shortlist of tools, feeds and reading. Nothing is added for you."
        actions={
          <Button variant="primary" onClick={() => setEditing(blank())}>
            <Plus className="size-4" /> Add resource
          </Button>
        }
      />

      {data.resources.length === 0 ? (
        <EmptyState
          icon={LibraryBig}
          title="No resources saved"
          description="Keep the handful of links you actually open every session in one place: your charting platform, your economic calendar, the broker statement page, a book you are working through."
          actions={
            <Button variant="primary" onClick={() => setEditing(blank())}>
              <Plus className="size-4" /> Add your first resource
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-2.5 text-sm font-semibold text-fg">{category}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {items.map((r) => (
                  <article key={r.id} className="group flex flex-col rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{r.title}</h3>
                      {/* a phone has no hover to reveal them, so they are always there */}
                      <div className="-my-2 flex shrink-0 gap-0.5 transition md:my-0 md:opacity-0 md:group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing(r)}
                          aria-label={`Edit ${r.title}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="hover:bg-loss/10 hover:text-loss"
                          onClick={() => remove(r)}
                          aria-label={`Remove ${r.title}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    {r.notes && <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">{r.notes}</p>}
                    {/* only ever an http(s) link: a javascript: one would run inside the app */}
                    {safeLink(r.url) && (
                      <a
                        href={safeLink(r.url)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-3 inline-flex items-center gap-1.5 truncate text-xs text-accent underline-offset-4 hover:underline"
                      >
                        <ExternalLink className="size-3.5 shrink-0" />
                        <span className="truncate">{r.url?.replace(/^https?:\/\//, '')}</span>
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
          title={editing.title ? 'Edit resource' : 'Add resource'}
        >
          <ResourceForm
            resource={editing}
            onCancel={() => setEditing(null)}
            onSave={(next) => {
              actions.upsertResource(next);
              setEditing(null);
              toast('Resource saved');
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
          setError('Give it a title');
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
      <Field label="Title" error={error}>
        <Input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="e.g. TradingView"
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
        <Field label="Link" hint="optional">
          <Input
            value={draft.url ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            placeholder="tradingview.com"
          />
        </Field>
        <Field label="Category">
          <Select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notes" hint="optional">
        <Textarea
          value={draft.notes ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="What you use it for"
        />
      </Field>
      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}
