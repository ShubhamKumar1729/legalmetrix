"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/audit-logs?limit=100').then(r => r.json()).then(d => { if (d.success) setLogs(d.data); });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Audit Log • Immutable Trail</h1>
      <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">All Actions Logged • Read-Only</CardTitle></CardHeader><CardContent className="space-y-2 max-h-[700px] overflow-auto">
        {logs.map((log: any) => (
          <div key={log.id} className="flex gap-3 p-3 rounded-xl border bg-white text-sm">
            <div className="w-2 h-2 rounded-full bg-slate-900 mt-2 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 items-center"><span className="font-medium">{log.userName}</span><Badge variant="outline" className="text-[10px]">{log.role}</Badge><span className="text-muted-foreground">•</span><span className="font-mono text-xs">{log.action}</span><span className="text-muted-foreground">•</span><span className="font-mono text-xs">{log.resource}:{log.resourceId}</span></div>
              <div className="text-xs text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()} • {log.ip} • {log.comment || 'No comment'}</div>
              {(log.oldValue || log.newValue) && <div className="mt-2 p-2 rounded-lg bg-muted text-xs font-mono">Old: {JSON.stringify(log.oldValue || {}).slice(0,100)} → New: {JSON.stringify(log.newValue || {}).slice(0,100)}</div>}
            </div>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
