'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Database, Brain, ScrollText, Settings, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession, type SystemInfo } from '@/components/session-provider';

export default function AdminPage() {
  const { session, can } = useSession();
  const [system, setSystem] = useState<SystemInfo | null>(session?.system ?? null);

  useEffect(() => {
    if (!can('config:read')) return;
    fetch('/api/configuration', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setSystem(body.data.status))
      .catch(() => undefined);
  }, [can]);

  const links = [
    can('user:read') && {
      href: '/app/admin/users',
      icon: Users,
      title: 'Users',
      description: 'Create accounts and assign Inspector, Reviewer or Administrator roles.',
    },
    can('audit:read') && {
      href: '/app/admin/audit-log',
      icon: ScrollText,
      title: 'Audit log',
      description: 'Every sign-in, inspection, review and rule change is recorded here.',
    },
    can('config:read') && {
      href: '/app/rules',
      icon: Settings,
      title: 'Rules',
      description: 'Configure and publish the regulatory rule set applied during analysis.',
    },
  ].filter(Boolean) as { href: string; icon: typeof Users; title: string; description: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Users, rules, audit trail and system configuration.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full border-0 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <link.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-semibold">{link.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {system && (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">System</CardTitle>
            <CardDescription>Current runtime configuration.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4" /> Data store
              </div>
              <div className="mt-2">
                <Badge variant={system.datastore === 'mongodb' ? 'compliant' : 'review'} className="text-[10px]">
                  {system.datastore === 'mongodb' ? 'MongoDB' : 'In-memory'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {system.datastore === 'mongodb'
                  ? 'Records are persisted in MongoDB.'
                  : 'MONGODB_URI is not reachable, so records are held in memory and lost on restart.'}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Brain className="h-4 w-4" /> Analysis provider
              </div>
              <div className="mt-2">
                <Badge variant={system.ai.developmentMode ? 'review' : 'compliant'} className="text-[10px]">
                  {system.ai.developmentMode ? 'No vision model connected' : 'Vision model connected'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {system.ai.developmentMode
                  ? 'Findings are routed to human review until AI_PROVIDER and AI_SERVICE_URL are configured.'
                  : 'Automated extraction is active.'}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {system.ai.providers.map((provider) => (
                  <li key={provider.name}>
                    {provider.name} · {provider.version}
                    {provider.development ? ' (development)' : ''}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">Accounts and rules</div>
              <dl className="mt-2 space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <dt>User accounts</dt>
                  <dd className="font-medium text-foreground">{system.userCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Published rules</dt>
                  <dd className="font-medium text-foreground">{system.rulesPublished}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Bootstrap administrator</dt>
                  <dd className="font-medium text-foreground">
                    {system.bootstrapConfigured ? 'Configured' : 'Not configured'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">Image uploads</div>
              <dl className="mt-2 space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <dt>Formats</dt>
                  <dd className="font-medium text-foreground">
                    {system.uploads.allowedFormats.map((format) => format.split('/')[1].toUpperCase()).join(', ')}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Maximum size</dt>
                  <dd className="font-medium text-foreground">{Math.round(system.uploads.maxBytes / 1024 / 1024)} MB</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Minimum dimension</dt>
                  <dd className="font-medium text-foreground">{system.uploads.minDimensionPx} px</dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
