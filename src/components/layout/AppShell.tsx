'use client';

import { useEffect, type ReactNode } from 'react';
import { FlaskConical, TriangleAlert } from 'lucide-react';
import { useJournal, useSaveState } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { LogoMark } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { TradeFormModal } from '@/components/trades/TradeFormModal';
import { useAndroidBack } from '@/hooks/useAndroidBack';
import { MobileNav, Sidebar } from './Sidebar';
import { Header } from './Header';
import { CopyNotice, RecoveredNotice, SaveConflictDialog } from './SaveConflict';
import { WelcomeModal } from './WelcomeModal';

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * The journal was saved by a newer version of the app than this one (see
 * newerJournal): nothing was opened and nothing is saved, so updating is the
 * way on. Its own component, so only it reads the save state.
 */
function NewerJournal() {
  const { filePath } = useSaveState();
  return (
    <main className="grid h-dvh place-items-center bg-app px-4 md:h-screen">
      <div role="alert" className="max-w-xl rounded-xl border border-line bg-surface p-6">
        <TriangleAlert aria-hidden className="size-6 text-warn" />
        <h1 className="mt-3 text-lg font-semibold text-fg">This journal needs a newer Sniper Journal</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          It was last saved by a newer version of the app, which keeps things this one doesn&apos;t know about. Opening
          it here could lose them, so it was left as it is: nothing in it has been changed.
        </p>
        <p className="mt-2 text-sm font-medium text-fg">Update Sniper Journal, then open it again.</p>
        {filePath && (
          <p className="mt-5 text-xs text-muted">
            Your journal is kept here:
            <span className="num mt-1 block break-all rounded-md border border-line bg-app px-3 py-2 text-fg">
              {filePath}
            </span>
          </p>
        )}
      </div>
    </main>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, newer, sampleCount, actions } = useJournal();
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

  if (newer != null) return <NewerJournal />;
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
      message: `This deletes the ${sampleCount} generated test trades, any chart images you attached to them, and the test playbook setups. Trades you entered yourself are kept.`,
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
        {/* relative: hidden inputs and other absolutely placed bits then scroll
            with the page inside main, instead of stretching the whole window */}
        <main data-page-scroll className="relative min-h-0 flex-1 overflow-y-auto max-md:overflow-x-hidden">
          <RecoveredNotice />
          <CopyNotice />
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
      <SaveConflictDialog />
    </div>
  );
}
