'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { cn, uid } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

interface TradeFormState {
  open: boolean;
  nonce: number;
  trade?: Trade;
  defaults?: Partial<Trade>;
}

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: string; message: string; kind: ToastKind }

interface UIContextValue {
  tradeForm: TradeFormState;
  openTradeForm: (opts?: { trade?: Trade; defaults?: Partial<Trade> }) => void;
  closeTradeForm: () => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, kind?: ToastKind) => void;
  globalSearch: string;
  setGlobalSearch: (value: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [tradeForm, setTradeForm] = useState<TradeFormState>({ open: false, nonce: 0 });
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { id: string }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const openTradeForm = useCallback((opts?: { trade?: Trade; defaults?: Partial<Trade> }) => {
    setTradeForm((s) => ({ open: true, nonce: s.nonce + 1, trade: opts?.trade, defaults: opts?.defaults }));
  }, []);

  const closeTradeForm = useCallback(() => setTradeForm((s) => ({ ...s, open: false })), []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({ ...options, id: uid() });
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setConfirmState(null);
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = uid();
    setToasts((list) => [...list, { id, message, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3600);
  }, []);

  const value = useMemo(
    () => ({ tradeForm, openTradeForm, closeTradeForm, confirm, toast, globalSearch, setGlobalSearch }),
    [tradeForm, openTradeForm, closeTradeForm, confirm, toast, globalSearch],
  );

  return (
    <UIContext.Provider value={value}>
      {children}

      <Modal
        open={Boolean(confirmState)}
        onClose={() => settle(false)}
        title={confirmState?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              {confirmState?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={confirmState?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => settle(true)}
              autoFocus
            >
              {confirmState?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">{confirmState?.message}</p>
      </Modal>

      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => {
          const Icon = t.kind === 'error' ? CircleAlert : t.kind === 'info' ? Info : CircleCheck;
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'animate-pop pointer-events-auto flex items-center gap-2.5 rounded-lg border bg-surface px-4 py-2.5 text-sm shadow-2xl shadow-black/40',
                t.kind === 'error' ? 'border-loss/40' : t.kind === 'info' ? 'border-accent/40' : 'border-profit/40',
              )}
            >
              <Icon className={cn('size-4', t.kind === 'error' ? 'text-loss' : t.kind === 'info' ? 'text-accent' : 'text-profit')} />
              <span className="text-fg">{t.message}</span>
            </div>
          );
        })}
      </div>
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIProvider');
  return ctx;
}
