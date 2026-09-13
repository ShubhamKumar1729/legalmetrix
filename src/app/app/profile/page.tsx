'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/components/session-provider';
import { SIMPLE_ROLE_DESCRIPTION } from '@/lib/auth/rbac';
import { formatDate } from '@/lib/labels';

export default function ProfilePage() {
  const { session } = useSession();

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/login';
  }

  if (!session) return null;

  const { user, simpleRole, simpleRoleLabel } = session;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account and access level.</p>
      </div>

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{simpleRoleLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-xl font-bold text-white">
              {(user.name || '')
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-semibold">{user.name}</div>
              <div className="text-muted-foreground">{user.email}</div>
              <Badge className="mt-1 text-[10px]">{simpleRoleLabel}</Badge>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{SIMPLE_ROLE_DESCRIPTION[simpleRole]}</p>

          <dl className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Official ID</dt>
              <dd className="mt-1 font-mono">{user.officialId || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Backend role</dt>
              <dd className="mt-1">{user.role.replace(/_/g, ' ').toLowerCase()}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Permissions</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {session.permissions.map((permission) => (
                  <Badge key={permission} variant="secondary" className="text-[10px]">
                    {permission}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <span className="text-muted-foreground">Session started {formatDate(new Date().toISOString())}</span>
          <Button variant="outline" className="rounded-full" onClick={signOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
