'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FINDING_STATUS_LABEL, SEVERITY_LABEL, STATUS_LABEL, formatDate, statusVariant } from '@/lib/labels';
import type { AuditLog, Inspection, Report } from '@/types';

interface ReportPayload {
  report: Report;
  inspection: Inspection | null;
  auditTrail: AuditLog[];
}

export default function ReportDetailPage() {
  const params = useParams<{ reportId: string }>();
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reports/${params.reportId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setData(body.data))
      .finally(() => setLoading(false));
  }, [params.reportId]);

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  if (!data) {
    return (
      <EmptyState
        icon={FileText}
        title="Report not found"
        description="This report could not be located."
        action={
          <Link href="/app/reports">
            <Button className="rounded-full">Back to Reports</Button>
          </Link>
        }
      />
    );
  }

  const { report, inspection, auditTrail } = data;
  const findings = inspection?.findings || [];

  function downloadPdf() {
    if (!inspection) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    let y = margin;

    const line = (text: string, size = 10, style: 'normal' | 'bold' = 'normal', gap = 14) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', style);
      const wrapped = doc.splitTextToSize(text, 500);
      doc.text(wrapped, margin, y);
      y += gap * wrapped.length;
    };

    line('Compliance Inspection Report', 18, 'bold', 26);
    line(report.reportNumber, 11, 'normal', 22);
    line(`Generated ${formatDate(report.createdAt)} by ${report.generatedByName}`, 9, 'normal', 20);

    line('Inspection', 13, 'bold', 18);
    line(`Inspection number: ${inspection.inspectionNumber}`);
    line(`Product: ${inspection.productName}`);
    line(`Brand: ${inspection.brand || '—'}`);
    line(`Category: ${inspection.category}`);
    line(`Manufacturer: ${inspection.manufacturer}`);
    line(`Inspected by: ${inspection.inspectorName} on ${formatDate(inspection.createdAt)}`);
    line(`Images captured: ${inspection.images?.length || 0}`, 10, 'normal', 22);

    line('Outcome', 13, 'bold', 18);
    line(`Status: ${STATUS_LABEL[inspection.status] || inspection.status}`);
    line(`Compliance score: ${inspection.scored ? `${inspection.complianceScore}/100` : 'Not scored'}`);
    line(`Rules evaluated: ${inspection.rulesEvaluated}`, 10, 'normal', 22);

    line('Findings', 13, 'bold', 18);
    if (findings.length === 0) {
      line('No rules were evaluated for this inspection.');
    }
    findings.forEach((finding) => {
      if (y > 760) {
        doc.addPage();
        y = margin;
      }
      line(
        `${finding.title} — ${FINDING_STATUS_LABEL[finding.status] || finding.status} (${SEVERITY_LABEL[finding.severity] || finding.severity})`,
        10,
        'bold',
        13
      );
      line(`Rule ${finding.ruleCode} · ${finding.legalReference || 'n/a'} · confidence ${finding.confidence}%`, 9);
      line(finding.description, 9);
      if (finding.detectedValue) line(`Detected: ${finding.detectedValue}`, 9);
      if (finding.correctedValue) line(`Corrected: ${finding.correctedValue}`, 9);
      if (finding.reviewerName) line(`Reviewed by ${finding.reviewerName} on ${formatDate(finding.reviewedAt)}`, 9);
      y += 6;
    });

    if (inspection.analysisNotes?.length) {
      if (y > 720) {
        doc.addPage();
        y = margin;
      }
      y += 10;
      line('Notes', 13, 'bold', 18);
      inspection.analysisNotes.forEach((note) => line(`• ${note}`, 9));
    }

    doc.save(`${report.reportNumber}.pdf`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <Link href="/app/reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Reports
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button className="rounded-full" onClick={downloadPdf} disabled={!inspection}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Compliance Inspection Report</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.reportNumber} · generated {formatDate(report.createdAt)} by {report.generatedByName}
              </p>
            </div>
            <Badge variant={statusVariant(report.status)} className="text-xs">
              {STATUS_LABEL[report.status] || report.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {inspection ? (
            <>
              <section className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Inspection number', inspection.inspectionNumber],
                  ['Product', inspection.productName],
                  ['Brand', inspection.brand || '—'],
                  ['Category', inspection.category],
                  ['Manufacturer', inspection.manufacturer],
                  ['Barcode', inspection.barcode || '—'],
                  ['Batch', inspection.batchNumber || '—'],
                  ['Inspected by', `${inspection.inspectorName} · ${formatDate(inspection.createdAt)}`],
                  ['Images', String(inspection.images?.length || 0)],
                  ['Rules evaluated', String(inspection.rulesEvaluated)],
                  ['Compliance score', inspection.scored ? `${inspection.complianceScore}/100` : 'Not scored'],
                  ['Rule set', inspection.ruleSetVersion],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="mt-0.5 font-medium">{value}</div>
                  </div>
                ))}
              </section>

              <section>
                <h2 className="mb-3 text-base font-semibold">Findings</h2>
                {findings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rules were evaluated for this inspection.</p>
                ) : (
                  <div className="space-y-3">
                    {findings.map((finding) => (
                      <div key={finding.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{finding.title}</div>
                            <p className="mt-1 text-sm text-muted-foreground">{finding.description}</p>
                          </div>
                          <Badge variant={statusVariant(finding.status)} className="text-[10px]">
                            {FINDING_STATUS_LABEL[finding.status] || finding.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                          <span>{finding.ruleCode}</span>
                          <span>{SEVERITY_LABEL[finding.severity] || finding.severity}</span>
                          {finding.detectedValue && <span>Detected: {finding.detectedValue}</span>}
                          {finding.correctedValue && <span>Corrected: {finding.correctedValue}</span>}
                          <span>Confidence {finding.confidence}%</span>
                          {finding.reviewerName && <span>Reviewed by {finding.reviewerName}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {inspection.analysisNotes?.length > 0 && (
                <section>
                  <h2 className="mb-2 text-base font-semibold">Notes</h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {inspection.analysisNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">The inspection record for this report is no longer available.</p>
          )}
        </CardContent>
      </Card>

      {auditTrail.length > 0 && (
        <Card className="border-0 bg-white shadow-sm print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {auditTrail.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span className="font-medium">{entry.action.replace(/_/g, ' ').toLowerCase()}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.userName} · {formatDate(entry.timestamp)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
