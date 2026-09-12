"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/products/${params.productId}`).then(r => r.json()).then(d => { if (d.success) setData(d.data); });
  }, [params.productId]);

  if (!data) return <div className="animate-pulse h-96 bg-muted rounded-xl" />;

  const product = data.product;
  const inspections = data.inspections || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold">{product.name}</h1><p className="text-sm text-muted-foreground">{product.brand} • {product.manufacturer} • {product.category}</p></div>
        <div className="flex gap-2"><Link href={`/app/products/${product.id}/history`}><Button variant="outline" className="rounded-full">History</Button></Link><Button className="rounded-full">New Inspection</Button></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Compliance Overview</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span>Total Inspections</span><span className="font-bold">{inspections.length}</span></div><div className="flex justify-between"><span>Violations</span><span className="font-bold text-red-600">{inspections.filter((i: any) => i.status === 'NON_COMPLIANT').length}</span></div><div className="flex justify-between"><span>Risk Score</span><span className="font-bold">{product.riskScore}</span></div></CardContent></Card>
        <Card className="lg:col-span-2 border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Recent Inspections</CardTitle></CardHeader><CardContent className="space-y-2">{inspections.slice(0, 5).map((i: any) => (<div key={i.id} className="flex justify-between items-center p-3 rounded-xl border"><div><div className="font-medium text-sm">{i.inspectionId}</div><div className="text-xs text-muted-foreground">{new Date(i.createdAt).toLocaleDateString()} • {i.complianceScore}/100</div></div><Badge variant={i.status === 'COMPLIANT' ? 'compliant' : i.status === 'NON_COMPLIANT' ? 'violation' : 'review'} className="text-[10px]">{i.status}</Badge></div>))}</CardContent></Card>
      </div>
    </div>
  );
}
