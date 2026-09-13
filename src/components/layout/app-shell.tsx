'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';
import { SessionProvider } from '@/components/session-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-[#f8fafc]">
        <div className="hidden md:block">
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute inset-y-0 left-0">
              <Sidebar collapsed={false} setCollapsed={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav onOpenNav={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
