'use client';

import { useEffect, type ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { LogoMark } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { TradeFormModal } from '@/components/trades/TradeFormModal';
import { useAndroidBack } from '@/hooks/useAndroidBack';
import { MobileNav, Sidebar } from './Sidebar';
import { Header } from './Header';
import { WelcomeModal } from './WelcomeModal';

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, sampleCount, actions } = useJournal();
  const { openTradeForm, confirm, toast } = useUI();
  useAndroidBack();

  // N logs a new trade from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('[data-modal-root]')) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openTradeForm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTradeForm]);

  if (!ready) {
    return (
      <div className="grid h-dvh place-items-center bg-app md:h-screen">
        <div className="flex flex-col items-center gap-3 text-sm text-muted">
          <LogoMark size={40} />
          Opening your journal
        </div>
      </div>
    );
  }

  const removeSample = async () => {
    const ok = await confirm({
      title: 'Remove test data?',
      message: `This deletes the ${sampleCount} generated test trades and the test playbook setups. Trades you entered yourself are kept.`,
      confirmLabel: 'Remove test data',
      tone: 'danger',
    });
    if (ok) {
      actions.clearSampleData();
      toast('Test data removed');
    }
  };

  return (
    // below md (a phone) the sidebar gives way to a tab bar at the bottom
    <div className="flex h-dvh overflow-hidden bg-app text-fg md:h-screen md:min-w-[1180px]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto max-md:overflow-x-hidden">
          {sampleCount > 0 && (
            <div className="flex items-center gap-3 border-b border-warn/25 bg-warn/10 px-4 py-2 text-sm md:px-6">
              <FlaskConical className="size-4 shrink-0 text-warn" />
              <span className="text-fg">
                Test data is loaded ({sampleCount} generated trades).
                <span className="text-muted max-md:hidden"> Remove it before you start logging real trades.</span>
              </span>
              <Button size="sm" variant="secondary" className="ml-auto" onClick={removeSample}>
                <span>
                  Remove<span className="max-md:hidden"> test data</span>
                </span>
              </Button>
            </div>
          )}
          <div className="mx-auto max-w-[1680px] px-4 pb-8 pt-4 md:px-6 md:pb-12 md:pt-6">{children}</div>
        </main>
        <MobileNav />
      </div>
      <TradeFormModal />
      <WelcomeModal />
    </div>
  );
}
