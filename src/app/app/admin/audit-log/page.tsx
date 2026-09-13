'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ScrollText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/labels';
import type { AuditLog } from '@/types';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/audit-logs?limit=200', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setLogs(body.data.logs || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <Link href="/app/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every sign-in, inspection, review and configuration change recorded by the system.
        </p>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No recent activity"
          description="Actions taken in the application will be recorded here."
        />
      ) : (
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left font-medium">When</th>
                    <th className="p-3 text-left font-medium">Action</th>
                    <th className="p-3 text-left font-medium">Resource</th>
                    <th className="hidden p-3 text-left font-medium sm:table-cell">User</th>
                    <th className="hidden p-3 text-left font-medium md:table-cell">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDate(log.timestamp)}</td>
                      <td className="p-3 font-medium">{log.action.replace(/_/g, ' ').toLowerCase()}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {log.resource}
                        {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ''}
                      </td>
                      <td className="hidden p-3 sm:table-cell">{log.userName}</td>
                      <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">
                        {log.role.replace(/_/g, ' ').toLowerCase()}
                      </td>
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
