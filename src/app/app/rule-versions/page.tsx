"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function RuleVersionsPage() {
  const versions = [
    { version: '1.2', status: 'PUBLISHED', date: '2024-03-15', rules: 8, author: 'Regulatory Admin', changes: 'Added unit price rule, updated font size requirements' },
    { version: '1.1', status: 'ARCHIVED', date: '2023-08-10', rules: 7, author: 'Super Admin', changes: 'Added readability clause' },
    { version: '1.0', status: 'ARCHIVED', date: '2022-01-01', rules: 6, author: 'Super Admin', changes: 'Initial LM-PC-2011 rule set' },
    { version: '1.3-draft', status: 'DRAFT', date: '2026-09-10', rules: 9, author: 'Regulatory Admin', changes: 'Draft: E-commerce specific rules' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Rule Version Management</h1>
      <div className="grid gap-4">
        {versions.map(v => (
          <Card key={v.version} className="border-0 shadow-sm"><CardContent className="p-5 flex justify-between items-center"><div><div className="flex items-center gap-2"><span className="font-mono font-bold">LM-PC-2011-v{v.version}</span><Badge variant={v.status === 'PUBLISHED' ? 'compliant' : v.status === 'DRAFT' ? 'review' : 'secondary'} className="text-[10px]">{v.status}</Badge></div><div className="text-sm mt-1">{v.changes}</div><div className="text-xs text-muted-foreground mt-1">{v.date} • {v.rules} rules • by {v.author}</div></div><div className="text-right"><div className="text-xs text-muted-foreground">Reproducibility</div><div className="text-xs mt-1">Reports with this version remain valid forever</div></div></CardContent></Card>
        ))}
      </div>
      <Card className="border-0 shadow-sm bg-slate-900 text-white"><CardContent className="p-5 text-sm"><div className="font-medium">Versioning Workflow</div><div className="text-slate-400 mt-2">DRAFT → VALIDATION → READY_FOR_APPROVAL → APPROVED → PUBLISHED → ARCHIVED • Every inspection stores exact rule-set version used • Historical reports reproducible</div></CardContent></Card>
    </div>
  );
}
