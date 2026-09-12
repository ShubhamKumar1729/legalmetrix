'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/explainer';
import { ScrollText } from 'lucide-react';

const ACTION_PLAIN: Record<string, string> = {
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  INSPECTION_CREATED: 'Started an inspection',
  AI_ANALYSIS_COMPLETED: 'AI finished analyzing an inspection',
  REVIEW_ACCEPT: 'Confirmed an AI finding',
  REVIEW_CORRECT: 'Corrected an AI finding',
  REVIEW_REJECT: 'Rejected an AI finding',
  RULE_CREATED: 'Drafted a rule',
  RULE_UPDATED: 'Changed a rule',
  RULE_PUBLISHED: 'Published a rule version',
  USER_CREATED: 'Added a user',
  USER_UPDATED: 'Updated a user',
  EVIDENCE_UPLOADED: 'Uploaded evidence photo',
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-stone-200',
  LOGOUT: 'bg-stone-200',
  INSPECTION_CREATED: 'bg-emerald-500',
  AI_ANALYSIS_COMPLETED: 'bg-emerald-500',
  REVIEW_CORRECT: 'bg-amber-500',
  REVIEW_REJECT: 'bg-red-500',
  RULE_UPDATED: 'bg-amber-500',
  RULE_PUBLISHED: 'bg-emerald-500',
  USER_CREATED: 'bg-orange-500',
  USER_UPDATED: 'bg-orange-500',
};

const ACTION_GROUPS = [
  { id: '', label: 'Everything' },
  { id: 'INSPECTION', label: 'Inspections & AI' },
  { id: 'FINDING', label: 'Review decisions' },
  { id: 'RULE', label: 'Rule changes' },
  { id: 'USER', label: 'User management' },
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [resource, setResource] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/audit-logs?limit=100${resource ? `&resource=${resource}` : ''}`)
      .then(r => r.json()).then(d => { if (d.success) setLogs(d.data); })
      .finally(() => setLoading(false));
  }, [resource]);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Log" inPlainWords="Who did what, in order. Entries are append-only — nobody, not even an admin, can edit or delete this." >
        <div className="flex gap-1.5 flex-wrap">
          {ACTION_GROUPS.map(g => (
            <Badge key={g.id || 'all'} variant={resource === g.id ? 'default' : 'outline'} className="cursor-pointer select-none px-3 py-1.5"
              onClick={() => setResource(g.id)}>{g.label}</Badge>
          ))}
        </div>
      </PageHeader>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScrollText className="w-4 h-4" />{logs.length} entr{logs.length === 1 ? 'y' : 'ies'}{loading && ' · loading…'}</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[700px] overflow-auto">
          {logs.map((log: any) => (
            <div key={log.id} className="flex gap-3 p-3 rounded-xl border bg-white text-sm">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${ACTION_COLORS[log.action] || 'bg-stone-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                  <span className="font-medium">{log.userName || 'System'}</span>
                  <span className="text-foreground">{ACTION_PLAIN[log.action] || log.action}</span>
                  <Badge variant="outline" className="text-[10px]">{log.role?.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs font-mono text-muted-foreground">{log.resource}:{String(log.resourceId).slice(0, 12)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()} • {log.ip || '—'}{log.comment ? ` • ${log.comment}` : ''}</div>
                {(log.oldValue || log.newValue) && <div className="mt-2 p-2 rounded-lg bg-stone-50 border text-xs font-mono break-all">before: {JSON.stringify(log.oldValue || {}).slice(0, 120)} → after: {JSON.stringify(log.newValue || {}).slice(0, 120)}</div>}
              </div>
            </div>
          ))}
          {!loading && logs.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nothing recorded yet for this filter.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
