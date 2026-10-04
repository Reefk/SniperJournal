'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, ImagePlus, LoaderCircle, Maximize2, Trash2 } from 'lucide-react';
import { deleteScreenshot, imageFromTransfer, screenshotSrc, uploadScreenshot } from '@/lib/screenshots';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * Add the chart you were looking at. Click, drag an image in, or just paste
 * with Ctrl+V while the trade form is open — screenshotting a chart and
 * pasting it is the fastest way to do this.
 */
export function ChartImage({
  file,
  onChange,
  onError,
}: {
  file?: string;
  onChange: (name: string | undefined) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const accept = async (picked: File | null | undefined) => {
    if (!picked) return;
    setBusy(true);
    const previous = file;
    const { name, error } = await uploadScreenshot(picked);
    setBusy(false);
    if (error || !name) {
      onError(error ?? 'Could not save the image.');
      return;
    }
    onChange(name);
    if (previous) void deleteScreenshot(previous);
  };

  // paste a screenshot straight into the open form
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const image = imageFromTransfer(e.clipboardData?.items);
      if (!image) return;
      e.preventDefault();
      void accept(image);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  const remove = () => {
    if (file) void deleteScreenshot(file);
    onChange(undefined);
  };

  return (
    <div className="rounded-lg border border-line p-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-fg">Chart</span>
        <span className="text-xs text-faint">{file ? 'saved with your journal' : 'click, drop or paste'}</span>
      </div>

      {file ? (
        <div className="group relative overflow-hidden rounded-md border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshotSrc(file)} alt="Chart for this trade" className="block max-h-44 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition group-hover:opacity-100">
            <Button size="sm" variant="secondary" onClick={() => setZoomed(true)}>
              <Maximize2 className="size-3.5" /> View
            </Button>
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
              Replace
            </Button>
            <Button size="sm" variant="danger" onClick={remove} aria-label="Remove chart">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void accept(imageFromTransfer(e.dataTransfer.items));
          }}
          className={cn(
            'flex w-full flex-col items-center justify-center rounded-md border border-dashed px-4 py-7 text-center transition',
            dragging ? 'border-accent bg-accent/5' : 'border-line-strong hover:border-accent/60',
          )}
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin text-accent" />
          ) : (
            <ImagePlus className="size-5 text-muted" />
          )}
          <span className="mt-2 text-xs text-muted">{busy ? 'Saving…' : 'Add a screenshot of the setup'}</span>
          <span className="mt-0.5 text-[11px] text-faint">Ctrl + V pastes one straight in</span>
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <Modal open={zoomed} onClose={() => setZoomed(false)} size="xl" title="Chart">
        {file && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotSrc(file)}
              alt="Chart for this trade"
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
            <a
              href={screenshotSrc(file)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-xs text-accent underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-3.5" /> Open the full size image
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}
