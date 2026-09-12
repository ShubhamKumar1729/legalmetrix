"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => { if (d.success) setUsers(d.data); });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold tracking-tight">User Management • RBAC</h1><Button className="rounded-full">Create User</Button></div>
      <Card className="border-0 shadow-sm"><CardContent className="p-0"><table className="w-full text-sm"><thead className="text-xs text-muted-foreground border-b bg-muted/30"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Email</th><th className="text-left p-3">Official ID</th><th className="text-left p-3">Role</th><th className="text-left p-3">Department</th><th className="text-left p-3">Status</th><th className="text-left p-3">Last Login</th></tr></thead><tbody>{users.map((u: any) => (<tr key={u.id} className="border-b last:border-0"><td className="p-3 font-medium">{u.name}</td><td className="p-3 text-xs">{u.email}</td><td className="p-3 font-mono text-xs">{u.officialId}</td><td className="p-3"><Badge variant="outline" className="text-[10px]">{u.role}</Badge></td><td className="p-3 text-xs">{u.department}</td><td className="p-3"><Badge variant={u.active ? 'compliant' : 'violation'} className="text-[10px]">{u.active ? 'Active' : 'Inactive'}</Badge></td><td className="p-3 text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '-'}</td></tr>))}</tbody></table></CardContent></Card>
      <Card className="border-0 shadow-sm bg-slate-50"><CardContent className="p-4 text-xs"><div className="font-medium">Roles & Permissions</div><div className="mt-2 grid md:grid-cols-3 gap-2 text-muted-foreground"><div>SUPER_ADMIN: Full access</div><div>REGULATORY_ADMIN: Rules, publishing</div><div>ENFORCEMENT_OFFICER: Create inspections</div><div>REVIEWER: Review findings, correct AI</div><div>ANALYST: Analytics, export</div><div>AUDITOR: Read-only audit logs</div></div></CardContent></Card>
    </div>
  );
}
