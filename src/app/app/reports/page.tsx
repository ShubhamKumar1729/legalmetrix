'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, STATUS_LABEL, statusVariant } from '@/lib/labels';
import type { Report } from '@/types';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setReports(body.data.reports || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compliance reports are generated from completed inspections.
        </p>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports generated yet"
          description="Complete an inspection and generate its compliance report — it will appear here."
          action={
            <Link href="/app/inspections/new">
              <Button className="rounded-full">
                <PlusCircle className="h-4 w-4" /> Start an Inspection
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left font-medium">Report</th>
                    <th className="p-3 text-left font-medium">Product</th>
                    <th className="p-3 text-left font-medium">Inspection</th>
                    <th className="p-3 text-left font-medium">Outcome</th>
                    <th className="p-3 text-right font-medium">Score</th>
                    <th className="hidden p-3 text-right font-medium sm:table-cell">Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <Link href={`/app/reports/${report.id}`} className="font-medium hover:underline">
                          {report.reportNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">by {report.generatedByName}</div>
                      </td>
                      <td className="p-3">{report.productName}</td>
                      <td className="p-3 text-muted-foreground">{report.inspectionNumber}</td>
                      <td className="p-3">
                        <Badge variant={statusVariant(report.status)} className="text-[10px]">
                          {STATUS_LABEL[report.status] || report.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium">{report.complianceScore}/100</td>
                      <td className="hidden p-3 text-right text-muted-foreground sm:table-cell">
                        {formatDate(report.createdAt)}
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
