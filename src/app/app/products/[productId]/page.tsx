'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/explainer';
import { StatusBadge } from '@/components/common/status-badges';
import Link from 'next/link';
import { ScanLine } from 'lucide-react';

export default function ProductDetailPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${params.productId}`).then(r => r.json())
      .then(d => { if (d.success) setData(d.data); else setNotFound(true); })
      .catch(() => setNotFound(true));
  }, [params.productId]);

  if (notFound) return <p className="text-sm text-muted-foreground">That product isn&apos;t in the repository yet.</p>;
  if (!data) return <div className="animate-pulse h-72 bg-muted rounded-xl" />;

  const product = data.product;
  const inspections = data.inspections || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        inPlainWords={`${product.brand} • ${product.manufacturer} • ${product.category}. Every time LegalMetrix looked at this product, it&rsquo;s listed here.`}
      >
        <Link href="/app/scan"><Button className="rounded-full"><ScanLine className="w-4 h-4 mr-2" />Inspect it again</Button></Link>
      </PageHeader>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Track record</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Times inspected</span><span className="font-bold">{inspections.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">With problems</span><span className="font-bold text-red-600">{inspections.filter((i: any) => i.status === 'NON_COMPLIANT').length}</span></div>
            <div className="flex justify-between" title="0–100. How likely this maker is to violate again — repeated problems raise it.">
              <span className="text-muted-foreground">Risk score</span>
              <span className={`font-bold ${product.riskScore > 70 ? 'text-red-600' : product.riskScore > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>{product.riskScore}</span>
            </div>
            <Link href={`/app/products/${product.id}/history`}><Button size="sm" variant="outline" className="rounded-full w-full mt-2">Full timeline</Button></Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Recent inspections</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {inspections.slice(0, 6).map((i: any) => (
              <Link key={i.id} href={`/app/scan/${i.id}`} className="block">
                <div className="flex justify-between items-center p-3 rounded-xl border hover:shadow-sm transition-shadow bg-white">
                  <div><div className="font-medium text-sm">{i.inspectionId} — {i.complianceScore}/100</div><div className="text-xs text-muted-foreground">{new Date(i.createdAt).toLocaleDateString()} • {i.inspectorName}</div></div>
                  <StatusBadge status={i.status} />
                </div>
              </Link>
            ))}
            {inspections.length === 0 && <div className="text-sm text-muted-foreground p-2">No inspections yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
