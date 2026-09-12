"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Administration • GovTech Control Center</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">User Management</CardTitle></CardHeader><CardContent><div className="text-sm text-muted-foreground">Create, deactivate, assign roles, reset password flow, view activity</div><Link href="/app/admin/users"><Button size="sm" className="mt-4 rounded-full">Manage Users</Button></Link></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Audit Log</CardTitle></CardHeader><CardContent><div className="text-sm text-muted-foreground">Immutable trail for all compliance-affecting actions</div><Link href="/app/admin/audit-log"><Button size="sm" className="mt-4 rounded-full">View Logs</Button></Link></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Rules</CardTitle></CardHeader><CardContent><div className="text-sm text-muted-foreground">Configurable regulatory rules, JSON DSL, versioned</div><Link href="/app/rules"><Button size="sm" className="mt-4 rounded-full">Manage Rules</Button></Link></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Rule Versions</CardTitle></CardHeader><CardContent><div className="text-sm text-muted-foreground">Draft → Validation → Approved → Published → Archived</div><Link href="/app/rule-versions"><Button size="sm" className="mt-4 rounded-full">Version History</Button></Link></CardContent></Card>
      </div>
    </div>
  );
}
