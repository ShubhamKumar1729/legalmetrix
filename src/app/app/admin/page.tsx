'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/explainer';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Administration" inPlainWords="Everything that shapes how inspections are judged: people, rules, thresholds and the AI model. Changes here are logged." />
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">People</CardTitle></CardHeader><CardContent><div className="text-sm text-muted-foreground">Who can sign in, and what their role allows.</div><Link href="/app/admin/users"><Button size="sm" className="mt-4 rounded-full">Manage users</Button></Link></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Activity Log</CardTitle></CardHeader><CardContent><div className="text-sm text-muted-foreground">The permanent, read-only record of every meaningful action.</div><Link href="/app/admin/audit-log"><Button size="sm" className="mt-4 rounded-full">View activity</Button></Link></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Rules Checklist</CardTitle></CardHeader><CardContent><div className="text-sm text-muted-foreground">The legal requirements every label is tested against.</div><Link href="/app/rules"><Button size="sm" className="mt-4 rounded-full">Manage rules</Button></Link></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Settings & AI Model</CardTitle></CardHeader><CardContent><div className="text-sm text-muted-foreground">Certainty thresholds, scoring weights, and which AI model the platform calls.</div><Link href="/app/admin/settings"><Button size="sm" className="mt-4 rounded-full">Open settings</Button></Link></CardContent></Card>
      </div>
    </div>
  );
}
