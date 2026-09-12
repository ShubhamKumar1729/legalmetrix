'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/explainer';
import { StatusBadge } from '@/components/common/status-badges';
import { FileText, Download, Eye, Search, Inbox } from 'lucide-react';
import Link from 'next/link';
import { downloadReport } from '@/lib/ui/report';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => { if (d.success) setReports(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = reports.filter(r => {
    const s = search.toLowerCase();
    return !s || r.reportId.toLowerCase().includes(s) || r.productName.toLowerCase().includes(s) || (r.inspector || '').toLowerCase().includes(s) || (r.status || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" inPlainWords="One official report per closed inspection. Each contains the findings, the evidence, the rule version used, and every human decision made." >
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search report, product, inspector…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-[280px]" />
        </div>
      </PageHeader>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                <tr><th className="text-left p-3 font-medium">Report</th><th className="text-left p-3 font-medium">Product</th><th className="text-left p-3 font-medium">Outcome</th><th className="text-left p-3 font-medium">Score</th><th className="text-left p-3 font-medium">Date</th><th className="text-left p-3 font-medium">Inspector</th><th className="text-right p-3 font-medium">Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3"><div className="font-mono text-xs">{r.reportId}</div><div className="text-[11px] text-muted-foreground">rules {r.ruleVersion} • model {r.aiModel}</div></td>
                    <td className="p-3"><div className="font-medium">{r.productName}</div><div className="text-xs text-muted-foreground">{r.manufacturer}</div></td>
                    <td className="p-3"><StatusBadge status={r.status} /></td>
                    <td className="p-3 font-bold" title="0–100">{r.complianceScore}</td>
                    <td className="p-3 text-xs">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="p-3 text-xs">{r.inspector}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Link href={`/app/reports/${r.id}`}><Button variant="ghost" size="icon" className="h-7 w-7" title="Open full report"><Eye className="w-3.5 h-3.5" /></Button></Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Download (demo text format)" onClick={() => downloadReport(r)}><Download className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && <p className="p-6 text-sm text-muted-foreground">Loading reports…</p>}
          {!loading && filtered.length === 0 && (
            <CardContent className="p-10 text-center text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-stone-400" />
              {reports.length === 0 ? <>No reports yet. Finish a scan and press “Generate report”.</> : 'No reports match your search.'}
            </CardContent>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="w-3.5 h-3.5" /> Reports are immutable once generated — corrections create a new report version, keeping old orders provable.</div>
    </div>
  );
}
