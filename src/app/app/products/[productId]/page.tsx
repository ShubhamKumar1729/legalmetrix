'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ClipboardList, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CATEGORY_LABEL, formatDate, STATUS_LABEL, statusVariant } from '@/lib/labels';
import type { Inspection, Product } from '@/types';

interface ProductDetail {
  product: Product & { inspectionCount: number; violationCount: number; riskScore: number };
  history: Inspection[];
  trend: { date: string; score: number | null; status: string; inspectionNumber: string }[];
}

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${params.productId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setData(body.data))
      .finally(() => setLoading(false));
  }, [params.productId]);

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  if (!data) {
    return (
      <EmptyState
        icon={Package}
        title="Product not found"
        description="This product record could not be located."
        action={
          <Link href="/app/products">
            <Button className="rounded-full">Back to Products</Button>
          </Link>
        }
      />
    );
  }

  const { product, history, trend } = data;

  return (
    <div className="space-y-6">
      <Link href="/app/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.brand || 'No brand'} · {product.manufacturer} · {CATEGORY_LABEL[product.category] || product.category}
          </p>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-2xl font-bold">{product.inspectionCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Inspections</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{product.violationCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Violations</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{product.riskScore}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk score</div>
          </div>
        </div>
      </div>

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inspection history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No inspections recorded for this product yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left font-medium">Inspection</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-right font-medium">Score</th>
                    <th className="p-3 text-right font-medium">Findings</th>
                    <th className="p-3 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((inspection) => (
                    <tr key={inspection.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <Link href={`/app/inspections/${inspection.id}`} className="font-medium hover:underline">
                          {inspection.inspectionNumber}
                        </Link>
                      </td>
                      <td className="p-3">
                        <Badge variant={statusVariant(inspection.status)} className="text-[10px]">
                          {STATUS_LABEL[inspection.status] || inspection.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium">
                        {inspection.scored ? `${inspection.complianceScore}/100` : '—'}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{inspection.findings?.length || 0}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatDate(inspection.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {trend.length > 0 && (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compliance trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {trend.map((point) => (
                <div key={point.inspectionNumber} className="rounded-xl border px-4 py-3 text-center">
                  <div className="text-lg font-bold">
                    {point.score === null ? '—' : `${point.score}`}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {point.date.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Link href="/app/inspections/new">
        <Button className="rounded-full">
          <ClipboardList className="h-4 w-4" /> Inspect this product again
        </Button>
      </Link>
    </div>
  );
}
