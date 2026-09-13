'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, statusVariant } from '@/lib/labels';
import type { Inspection } from '@/types';

interface QueueItem {
  inspection: Inspection;
  pending: number;
}

export default function ReviewPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/inspections?limit=200', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (!body.success) return;
        const queue: QueueItem[] = (body.data.inspections as Inspection[])
          .map((inspection) => ({
            inspection,
            pending: (inspection.findings || []).filter((f) => f.reviewStatus === 'PENDING').length,
          }))
          .filter((item) => item.pending > 0);
        setItems(queue);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalPending = items.reduce((sum, item) => sum + item.pending, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Findings that could not be confirmed automatically and need a human decision.
        </p>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No findings currently require review"
          description="When an inspection produces an uncertain finding, it appears here for confirmation."
          action={
            <Link href="/app/inspections">
              <Button variant="outline" className="rounded-full">
                View Inspections
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {totalPending} finding{totalPending === 1 ? '' : 's'} awaiting review across {items.length} inspection
            {items.length === 1 ? '' : 's'}.
          </p>

          <div className="space-y-4">
            {items.map(({ inspection, pending }) => (
              <Card key={inspection.id} className="border-0 bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-4">
                      {inspection.images?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={inspection.images[0].url}
                          alt={inspection.productName}
                          className="h-16 w-16 rounded-xl border object-cover"
                        />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{inspection.productName}</span>
                          <Badge variant={statusVariant(inspection.status)} className="text-[10px]">
                            {inspection.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {inspection.inspectionNumber} · {inspection.manufacturer}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(inspection.findings || [])
                            .filter((f) => f.reviewStatus === 'PENDING')
                            .slice(0, 4)
                            .map((finding) => (
                              <Badge key={finding.id} variant="review" className="text-[10px]">
                                {finding.title} · {finding.confidence}%
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold">
                        {inspection.scored ? `${inspection.complianceScore}/100` : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">{pending} to review</div>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <Link href={`/app/inspections/${inspection.id}`}>
                          <Button size="sm" variant="outline" className="h-8 rounded-full">
                            <Eye className="h-3.5 w-3.5" /> Open
                          </Button>
                        </Link>
                        <Link href={`/app/inspections/${inspection.id}?review=1`}>
                          <Button size="sm" className="h-8 rounded-full">
                            Review Findings
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                    <span>Created {formatDate(inspection.createdAt)}</span>
                    <span>By {inspection.inspectorName}</span>
                    <span>
                      {(inspection.findings || []).filter((f) => f.status === 'VIOLATION').length} violation(s) recorded
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
