'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/status-badges';
import { Notice } from '@/components/common/explainer';
import { downloadReport } from '@/lib/ui/report';
import { Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReportDetailPage() {
  const params = useParams();
  const [report, setReport] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => {
      const found = d?.success ? d.data.find((r: any) => r.id === params.reportId || r.reportId === params.reportId) : null;
      if (found) setReport(found); else setNotFound(true);
    }).catch(() => setNotFound(true));
  }, [params.reportId]);

  if (notFound) return <Notice tone="warn">This report no longer exists. It may belong to a session that was reset.</Notice>;
  if (!report) return <div className="animate-pulse h-96 bg-muted rounded-xl" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <Link href="/app/reports" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="w-3 h-3" />All reports</Link>
          <h1 className="text-2xl font-bold mt-1">{report.reportId}</h1>
        </div>
        <Button className="rounded-full" onClick={() => downloadReport(report)}><Download className="w-4 h-4 mr-2" />Download report</Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Compliance Report — Legal Metrology (Packaged Commodities) Rules, 2011</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ['Inspection number', report.inspectionNumber, 'font-mono'],
              ['Product', report.productName, 'font-medium'],
              ['Manufacturer', report.manufacturer || '—', ''],
              ['Outcome', null, ''],
              ['Compliance score', `${report.complianceScore}/100`, 'font-bold'],
              ['Inspector', report.inspector, ''],
              ['Date', new Date(report.date).toLocaleString(), ''],
              ['Rule set used', report.ruleVersion, 'font-mono'],
              ['AI model used', report.aiModel, 'font-mono'],
            ].map(([k, v, cls]: any) => (
              <div key={k}>
                <div className="text-xs uppercase text-muted-foreground">{k}</div>
                {k === 'Outcome'
                  ? <div className="mt-1"><StatusBadge status={report.status} /></div>
                  : <div className={`mt-1 ${cls}`}>{v}</div>}
              </div>
            ))}
          </div>

          <div className="border-t pt-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">What this report contains</div>
            <div className="grid md:grid-cols-2 gap-2.5 text-xs">
              {[
                '✓ Product, manufacturer, inspector, date & location',
                '✓ Package photos with highlighted evidence regions',
                '✓ Every declaration the AI read, with certainty scores',
                '✓ Findings with the exact rule & legal reference cited',
                '✓ Human decisions (accept / correct / reject) with reasons',
                '✓ Rule-set version + AI model version for reproducibility',
              ].map(x => <div key={x} className="p-3 rounded-xl bg-stone-50 border">{x}</div>)}
            </div>
          </div>

          <Notice tone="neutral">
            <strong>Status:</strong> This is an AI-assisted assessment. It has authority only through the signature of the officer named above — AI values and human decisions are shown separately.
            The PDF export (with images and signature block) is produced by the same data in the production build.
          </Notice>
        </CardContent>
      </Card>
    </div>
  );
}
