"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Globe, AlertTriangle, CheckCircle2, Search } from 'lucide-react';

export default function EcommercePage() {
  const [url, setUrl] = useState('https://www.amazon.in/FreshBite-Premium-Biscuits-500g/dp/B0XXXX');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ecommerce/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (data.success) setResult(data.data);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">E-commerce Compliance Scanner</h1><p className="text-sm text-muted-foreground">Compare online listing vs physical package • Detect MRP, quantity, manufacturer mismatches</p></div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Listing URL Analysis</CardTitle><CardDescription>Supports Amazon, Flipkart, generic providers via EcommerceProvider interface</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2"><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="flex-1" /><Button onClick={analyze} disabled={loading} className="rounded-full">{loading ? 'Analyzing...' : 'Analyze Listing'}<Search className="w-4 h-4 ml-2" /></Button></div>
          <div className="text-xs text-muted-foreground">Architecture: EcommerceProvider → MockEcommerceProvider (dev) → Real scraper/API later • No hard dependency on single site</div>
        </CardContent>
      </Card>

      {result && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Listing Information • {result.listing.platform}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="font-medium">{result.listing.productName}</span></div><div className="flex justify-between"><span className="text-muted-foreground">MRP</span><span className="font-medium">{result.listing.mrp}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span className="font-medium">{result.listing.netQuantity}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Manufacturer</span><span className="font-medium">{result.listing.manufacturer}</span></div><div className="text-xs text-muted-foreground mt-2">Extracted at {new Date(result.listing.extractedAt).toLocaleString()}</div></CardContent></Card>

          <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Comparison • Package vs Listing</CardTitle></CardHeader><CardContent className="space-y-3">
            {result.comparison.map((c: any) => (
              <div key={c.field} className={`p-3 rounded-xl border flex justify-between items-center ${c.match ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div><div className="font-medium text-sm">{c.field}</div><div className="text-xs text-muted-foreground">Listing: {c.listingValue} • Package: {c.packageValue}</div></div>
                <Badge variant={c.match ? 'compliant' : 'violation'} className="text-[10px]">{c.status}</Badge>
              </div>
            ))}
            <div className={`mt-4 p-4 rounded-xl flex gap-3 ${result.overallStatus === 'MISMATCH' ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              {result.overallStatus === 'MISMATCH' ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              <div><div className="font-medium text-sm">{result.overallStatus} • Compliance {result.complianceScore}%</div><div className="text-xs mt-1">MRP mismatch is critical violation per Legal Metrology Rules</div></div>
            </div>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
