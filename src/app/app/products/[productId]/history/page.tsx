"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProductHistoryPage() {
  const params = useParams();
  const [history, setHistory] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/products/${params.productId}/history`).then(r => r.json()).then(d => { if (d.success) { setHistory(d.data.history); setTrend(d.data.trend); } });
  }, [params.productId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Compliance History • Timeline</h1>
      <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Chronological Inspections</CardTitle></CardHeader><CardContent className="space-y-4">
        {history.map((h: any, idx: number) => (
          <div key={h.id} className="flex gap-4">
            <div className="flex flex-col items-center"><div className={`w-3 h-3 rounded-full ${h.status === 'COMPLIANT' ? 'bg-emerald-500' : h.status === 'NON_COMPLIANT' ? 'bg-red-500' : 'bg-amber-500'}`} /><div className="w-0.5 h-12 bg-muted mt-1" /></div>
            <div className="flex-1 pb-6"><div className="flex justify-between"><span className="font-medium text-sm">{h.inspectionId} • {h.complianceScore}/100</span><Badge variant={h.status === 'COMPLIANT' ? 'compliant' : h.status === 'NON_COMPLIANT' ? 'violation' : 'review'} className="text-[10px]">{h.status}</Badge></div><div className="text-xs text-muted-foreground mt-1">{new Date(h.createdAt).toLocaleString()} • {h.inspectorName}</div><div className="text-xs mt-2">{h.findings?.filter((f: any) => f.status !== 'PASS').map((f: any) => f.title).join(', ') || 'Compliant'}</div></div>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
