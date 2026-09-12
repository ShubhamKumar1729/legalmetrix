'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

const ROLE_PLAIN: Record<string, string> = {
  SUPER_ADMIN: 'Administrator — full access',
  REGULATORY_ADMIN: 'Rules & settings owner',
  ENFORCEMENT_OFFICER: 'Field inspector — scans & reports',
  REVIEWER: 'Final decision-maker on flagged findings',
  ANALYST: 'Trends, risk & report downloads',
  AUDITOR: 'Read-only access to everything',
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    fetch('/api/auth/me').then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.success) { setUser(d.data); localStorage.setItem('user', JSON.stringify(d.data)); } })
      .catch(() => { try { setUser(JSON.parse(localStorage.getItem('user') || 'null')); } catch {} });
  }, []);

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">My profile</h1>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Your official identity</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-stone-900 text-white flex items-center justify-center text-xl font-bold">{user?.name?.charAt(0) || '…'}</div>
            <div>
              <div className="font-semibold text-lg">{user?.name || 'Loading…'}</div>
              <div className="text-muted-foreground">{user?.email || ''}</div>
              <Badge className="mt-1.5 text-[10px]">{ROLE_PLAIN[user?.role] || user?.role || ''}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div><div className="text-xs text-muted-foreground uppercase">Official ID</div><div className="font-mono mt-1">{user?.officialId || '—'}</div></div>
            <div><div className="text-xs text-muted-foreground uppercase">Why this matters</div><div className="mt-1 text-muted-foreground">Every decision you make is permanently attributed to this ID.</div></div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm"><CardContent className="p-4"><Button variant="outline" className="w-full rounded-full" onClick={logout}>Sign out of this device</Button></CardContent></Card>
    </div>
  );
}
