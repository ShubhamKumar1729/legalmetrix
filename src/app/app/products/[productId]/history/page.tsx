'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/explainer';
import { StatusBadge } from '@/components/common/status-badges';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ProductHistoryPage() {
  const params = useParams();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/products/${params.productId}/history`).then(r => r.json())
      .then(d => { if (d.success) setHistory(d.data.history); })
      .catch(() => {});
  }, [params.productId]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href={`/app/products/${params.productId}`} className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="w-3 h-3" />Back to product</Link>
      <PageHeader title="Inspection timeline" inPlainWords="Oldest at the bottom. If green dots drift toward amber or red, the maker's labeling is getting worse — a signal to inspect sooner." />

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">{history.length} inspection{history.length === 1 ? '' : 's'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {history.map((h: any) => (
            <div key={h.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${h.status === 'COMPLIANT' ? 'bg-emerald-500' : h.status === 'NON_COMPLIANT' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="w-0.5 h-10 bg-stone-200 mt-1" />
              </div>
              <Link href={`/app/scan/${h.id}`} className="flex-1 pb-5 min-w-0 hover:bg-stone-50 rounded-lg -mx-2 px-2 transition-colors">
                <div className="flex justify-between gap-2 items-center">
                  <span className="font-medium text-sm">{h.inspectionId} • score {h.complianceScore}/100</span>
                  <StatusBadge status={h.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(h.createdAt).toLocaleString()} • {h.inspectorName}</div>
                <div className="text-xs mt-1.5 text-foreground/80">
                  {h.findings?.filter((f: any) => f.status !== 'PASS').length
                    ? <>Flagged: {h.findings.filter((f: any) => f.status !== 'PASS').map((f: any) => f.title).join(', ')}</>
                    : <>Everything was in order.</>}
                </div>
              </Link>
            </div>
          ))}
          {history.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nothing on record yet — <Link href="/app/scan" className="text-emerald-700 underline">start the first scan</Link>.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
