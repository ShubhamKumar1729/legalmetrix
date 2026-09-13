'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/components/session-provider';
import { api, errorMessage } from '@/lib/client/api';
import { formatDate } from '@/lib/labels';
import { SIMPLE_ROLE_DESCRIPTION, simpleRole } from '@/lib/auth/rbac';
import type { Role, SimpleRole, User } from '@/types';

/**
 * Officers are shown the three roles the product is built around. The backend keeps
 * its finer-grained roles, but they are grouped underneath rather than presented as a
 * flat list of six — an administrator creating an account should not have to know the
 * difference between an analyst and an auditor to do the common thing.
 */
const PRIMARY_ROLE: Record<SimpleRole, { value: Role; label: string }> = {
  INSPECTOR: { value: 'ENFORCEMENT_OFFICER', label: 'Inspector — captures packages and submits inspections' },
  REVIEWER: { value: 'REVIEWER', label: 'Reviewer — reviews uncertain or flagged findings' },
  ADMIN: { value: 'REGULATORY_ADMIN', label: 'Administrator — manages rules, users and configuration' },
};

/** Additional backend roles, offered only when an administrator asks for them. */
const ADVANCED_ROLES: { value: Role; label: string }[] = [
  { value: 'ANALYST', label: 'Analyst (read-only reporting)' },
  { value: 'AUDITOR', label: 'Auditor (read-only audit trail)' },
  { value: 'SUPER_ADMIN', label: 'Super administrator (everything, cannot be demoted)' },
];

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  officialId: string;
  department: string;
}

const EMPTY_FORM: NewUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'ENFORCEMENT_OFFICER',
  officialId: '',
  department: '',
};

export default function UsersPage() {
  const { can, session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAdvancedRoles, setShowAdvancedRoles] = useState(false);
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/users', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setUsers(body.data.users || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function createUser() {
    setSaving(true);
    setError('');
    try {
      await api.post('/api/users', form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (createError) {
      setError(errorMessage(createError, 'The account could not be created.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    setError('');
    try {
      await api.patch(`/api/users/${user.id}`, { active: !user.active });
      load();
    } catch (updateError) {
      setError(errorMessage(updateError, 'The account could not be updated.'));
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/app/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts are created here — the application has no built-in users.
          </p>
        </div>
        {can('user:write') && (
          <Button className="rounded-full" onClick={() => setShowForm((open) => !open)}>
            {showForm ? 'Close' : <><UserPlus className="h-4 w-4" /> New User</>}
          </Button>
        )}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {showForm && (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">New user</CardTitle>
            <CardDescription>
              Inspectors capture and submit inspections, Reviewers confirm flagged findings, Administrators manage
              rules and users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-name">Full name *</Label>
                <Input id="user-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email *</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Temporary password *</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">At least 8 characters. Share it through a secure channel.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Role *</Label>
                <select
                  id="user-role"
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <optgroup label="Roles">
                    {(Object.keys(PRIMARY_ROLE) as SimpleRole[]).map((key) => (
                      <option key={key} value={PRIMARY_ROLE[key].value}>
                        {PRIMARY_ROLE[key].label}
                      </option>
                    ))}
                  </optgroup>
                  {showAdvancedRoles && (
                    <optgroup label="Additional backend roles">
                      {ADVANCED_ROLES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{SIMPLE_ROLE_DESCRIPTION[simpleRole(form.role)]}</p>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedRoles((open) => !open)}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {showAdvancedRoles ? 'Fewer roles' : 'More roles'}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-official">Official ID</Label>
                <Input
                  id="user-official"
                  value={form.officialId}
                  onChange={(event) => setForm({ ...form, officialId: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-department">Department</Label>
                <Input
                  id="user-department"
                  value={form.department}
                  onChange={(event) => setForm({ ...form, department: event.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button className="rounded-full" onClick={createUser} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No user accounts"
          description={
            can('user:write')
              ? 'Create the first account to start using the application.'
              : 'An administrator needs to create your account.'
          }
        />
      ) : (
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">Email</th>
                    <th className="p-3 text-left font-medium">Role</th>
                    <th className="hidden p-3 text-left font-medium sm:table-cell">Last sign-in</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    {can('user:write') && <th className="p-3 text-right font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="p-3">
                        <span className="font-medium">{user.name}</span>
                        {user.id === session?.user.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                        {user.department && <div className="text-xs text-muted-foreground">{user.department}</div>}
                      </td>
                      <td className="p-3 text-muted-foreground">{user.email}</td>
                      <td className="p-3 text-xs">{user.role.replace(/_/g, ' ').toLowerCase()}</td>
                      <td className="hidden p-3 text-muted-foreground sm:table-cell">{formatDate(user.lastLogin)}</td>
                      <td className="p-3">
                        <Badge variant={user.active ? 'compliant' : 'secondary'} className="text-[10px]">
                          {user.active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      {can('user:write') && (
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full"
                            onClick={() => toggleActive(user)}
                            disabled={user.id === session?.user.id}
                          >
                            {user.active ? 'Disable' : 'Enable'}
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
      )}
    </div>
  );
}
