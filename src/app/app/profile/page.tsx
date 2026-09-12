"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch {}
    }
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile • Official Identity</h1>
      <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Enforcement Officer</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-xl font-bold">{user?.name?.charAt(0) || 'R'}</div><div><div className="font-semibold text-lg">{user?.name || 'Rajesh Kumar'}</div><div className="text-muted-foreground">{user?.email || 'officer@gov.in'}</div><Badge className="mt-1 text-[10px]">{user?.role || 'ENFORCEMENT_OFFICER'}</Badge></div></div><div className="grid grid-cols-2 gap-4 pt-4 border-t"><div><div className="text-xs text-muted-foreground uppercase">Official ID</div><div className="font-mono mt-1">{user?.officialId || 'GOV-EO-042'}</div></div><div><div className="text-xs text-muted-foreground uppercase">Department</div><div className="mt-1">Legal Metrology - Punjab</div></div></div></CardContent></Card>
      <Card className="border-0 shadow-sm"><CardContent className="p-4"><Button variant="outline" className="w-full rounded-full" onClick={() => { localStorage.clear(); window.location.href='/login'; }}>Logout • Clear Session</Button></CardContent></Card>
    </div>
  );
}
