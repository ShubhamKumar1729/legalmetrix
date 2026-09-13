'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { Role, SimpleRole } from '@/types';

export interface SystemInfo {
  datastore: 'mongodb' | 'memory';
  mongodbConfigured: boolean;
  ai: { providers: { name: string; version: string; development: boolean }[]; developmentMode: boolean };
  rulesPublished: number;
  userCount: number;
  bootstrapConfigured: boolean;
  uploads: { allowedFormats: string[]; maxBytes: number; minDimensionPx: number };
}

export interface Session {
  user: { id: string; email: string; name: string; role: Role; officialId: string };
  simpleRole: SimpleRole;
  simpleRoleLabel: string;
  permissions: string[];
  system: SystemInfo;
}

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  refresh: async () => undefined,
  can: () => false,
});

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.status === 401) {
        setSession(null);
        window.location.href = '/login';
        return;
      }
      const body = await res.json();
      if (body.success) setSession(body.data as Session);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        refresh,
        can: (permission: string) => Boolean(session?.permissions.includes(permission)),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
