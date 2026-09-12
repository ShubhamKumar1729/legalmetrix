'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Explainer } from '@/components/common/explainer';
import { UserPlus, Loader2, X, ShieldCheck, ShieldOff } from 'lucide-react';

const ROLE_PLAIN: Record<string, string> = {
  SUPER_ADMIN: 'Can do everything, including user management',
  REGULATORY_ADMIN: 'Owns the rules checklist and settings',
  ENFORCEMENT_OFFICER: 'Runs scans, writes reports — cannot judge or change rules',
  REVIEWER: 'Makes the final call on flagged findings',
  ANALYST: 'Reads trends and downloads reports',
  AUDITOR: 'Read-only everything, including the activity log',
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', officialId: '', role: 'ENFORCEMENT_OFFICER', department: '', password: '' });

  async function load() {
    const res = await fetch('/api/users');
    if (res.ok) { const d = await res.json(); if (d.success) setUsers(d.data); }
  }
  useEffect(() => {
    load();
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      setCanWrite(!!u && u.role === 'SUPER_ADMIN');
    } catch {}
  }, []);

  const create = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d?.error?.message || 'Could not create the user');
      setShowCreate(false);
      setNotice(`${d.data.name} can now sign in with the chosen password.`);
      setForm({ name: '', email: '', officialId: '', role: 'ENFORCEMENT_OFFICER', department: '', password: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const toggleActive = async (u: any) => {
    setNotice('');
    const res = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, active: !u.active }) });
    const d = await res.json();
    if (d.success) { setNotice(`${u.name} is now ${u.active ? 'disabled' : 'active'}.`); await load(); }
    else setError(d?.error?.message || 'Could not update the user');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Users" inPlainWords="People who can sign in, and what their role lets them do. Disabling keeps history attributed to them forever.">
        {canWrite && <Button className="rounded-full" onClick={() => setShowCreate(true)}><UserPlus className="w-4 h-4 mr-2" />Add user</Button>}
      </PageHeader>

      {notice && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{notice}</div>}
      {error && <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                <tr><th className="text-left p-3 font-medium">Name</th><th className="text-left p-3 font-medium">Email</th><th className="text-left p-3 font-medium">Official ID</th><th className="text-left p-3 font-medium">Role</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Last sign-in</th>{canWrite && <th className="text-right p-3 font-medium">Action</th>}</tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3 text-xs">{u.email}</td>
                    <td className="p-3 font-mono text-xs">{u.officialId}</td>
                    <td className="p-3"><Badge variant="outline" className="text-[10px]" title={ROLE_PLAIN[u.role] || ''}>{u.role.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())}</Badge></td>
                    <td className="p-3"><Badge variant={u.active ? 'compliant' : 'violation'} className="text-[10px]">{u.active ? 'Active' : 'Disabled'}</Badge></td>
                    <td className="p-3 text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'never'}</td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" className={`rounded-full h-7 text-xs ${u.active ? 'text-red-700 border-red-200 hover:bg-red-50' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`} onClick={() => toggleActive(u)}>
                          {u.active ? <><ShieldOff className="w-3 h-3 mr-1" />Disable</> : <><ShieldCheck className="w-3 h-3 mr-1" />Enable</>}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Explainer title="What the roles mean" defaultOpen={false}>
        <div className="grid md:grid-cols-2 gap-2">
          {Object.entries(ROLE_PLAIN).map(([role, plain]) => (
            <div key={role} className="flex gap-2 items-baseline"><Badge variant="outline" className="text-[10px] flex-shrink-0">{role.replace(/_/g, ' ')}</Badge><span>{plain}</span></div>
          ))}
        </div>
      </Explainer>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4" onClick={() => !saving && setShowCreate(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md border shadow-xl p-6 space-y-3.5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-lg">Add a user</h2><button onClick={() => setShowCreate(false)} aria-label="Close"><X className="w-5 h-5 text-muted-foreground" /></button></div>
            <p className="text-sm text-muted-foreground">They sign in with this password immediately; every action they take is attributed to their Official ID.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Full name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Official ID</Label><Input value={form.officialId} onChange={e => setForm({ ...form, officialId: e.target.value })} placeholder="GOV-XX-000" /></div>
              <div className="space-y-1 col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@gov.in" /></div>
              <div className="space-y-1"><Label>Role</Label>
                <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {Object.keys(ROLE_PLAIN).map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
              <div className="space-y-1 col-span-2"><Label>Temporary password (min 8 chars)</Label><Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            </div>
            <div className="text-xs text-muted-foreground">{ROLE_PLAIN[form.role]}</div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-full" disabled={saving} onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="rounded-full" disabled={saving || !form.name || !form.email || !form.officialId || form.password.length < 8} onClick={create}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Create user'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
