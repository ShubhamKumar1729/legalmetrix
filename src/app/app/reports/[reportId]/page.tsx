"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ReportDetailPage() {
  const params = useParams();
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => {
      if (d.success) {
        const found = d.data.find((r: any) => r.id === params.reportId || r.reportId === params.reportId);
        if (found) setReport(found);
      }
    });
  }, [params.reportId]);

  if (!report) return <div className="animate-pulse h-96 bg-muted rounded-xl" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">{report.reportId}</h1><Button className="rounded-full">Download PDF</Button></div>

      <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Government Compliance Report • Legal Metrology (Packaged Commodities) Rules, 2011</CardTitle></CardHeader><CardContent className="space-y-6 text-sm">
        <div className="grid grid-cols-2 gap-4"><div><div className="text-xs uppercase text-muted-foreground">Inspection ID</div><div className="font-mono font-medium">{report.inspectionNumber}</div></div><div><div className="text-xs uppercase text-muted-foreground">Product</div><div className="font-medium">{report.productName}</div></div><div><div className="text-xs uppercase text-muted-foreground">Compliance Score</div><div className="font-bold text-lg">{report.complianceScore}/100</div></div><div><div className="text-xs uppercase text-muted-foreground">Status</div><Badge variant={report.status === 'COMPLIANT' ? 'compliant' : report.status === 'NON_COMPLIANT' ? 'violation' : 'review'}>{report.status}</Badge></div></div>

        <div className="border-t pt-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Report Includes</div>
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-muted">✓ Inspection ID, Product details, Manufacturer/Brand, Inspector, Date/Time, Location</div>
            <div className="p-3 rounded-xl bg-muted">✓ Package images with bounding boxes, cropped evidence</div>
            <div className="p-3 rounded-xl bg-muted">✓ Detected declarations, confidence, rule references</div>
            <div className="p-3 rounded-xl bg-muted">✓ Violations, warnings, severity, review decisions</div>
            <div className="p-3 rounded-xl bg-muted">✓ Rule-set version, AI model version, processing metadata</div>
            <div className="p-3 rounded-xl bg-muted">✓ Audit trail, reviewer corrections, evidence traceability</div>
          </div>
        </div>

        <div className="border-t pt-6 text-xs text-muted-foreground leading-relaxed">
          This report is AI-assisted compliance assessment, not legal authority. Final enforcement decisions attributable to authorized officials. AI Assessment vs Human Review vs Final Decision shown separately per product safety principle.
          <br /><br />
          Evidence traceability: Finding → Evidence (Image + BoundingBox) → AI Output (Model {report.aiModel}) → Rule (Version {report.ruleVersion}) → Reviewer Decision → Final Report
        </div>
      </CardContent></Card>
    </div>
  );
}
