'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader, Explainer } from '@/components/common/explainer';
import { Globe, AlertTriangle, CheckCircle2, Search, Loader2 } from 'lucide-react';

export default function EcommercePage() {
  const [url, setUrl] = useState('https://www.amazon.in/FreshBite-Premium-Biscuits-500g/dp/B0XXXX');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ecommerce/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error?.message || 'Analysis failed');
      setResult(data.data);
    } catch (e: any) {
      setError(e.message || 'Could not reach the listing analyzer.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Online Listings" inPlainWords="Shops must sell online exactly what the physical package declares. Paste a listing link — LegalMetrix compares price, quantity and maker, and flags any mismatch." />

      <Explainer title="What counts as a mismatch?" defaultOpen={false}>
        <p>The law says the online listing must match the package declaration. A different online MRP than printed on the pack is a violation; a differently-worded address is a warning that a human should eyeball.</p>
        <p className="text-muted-foreground">In this build, a demo listing provider is used — it returns the same fictional FreshBite listing for any URL. The real scraper plugs in behind the same interface later (see ARCHITECTURE.md).</p>
      </Explainer>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Check a listing</CardTitle><CardDescription>Amazon and Flipkart links are recognized; other URLs use the generic reader.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste the product page link…" className="flex-1" />
            <Button onClick={analyze} disabled={loading || !url.trim()} className="rounded-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading listing…</> : <>Compare with package <Search className="w-4 h-4 ml-2" /></>}
            </Button>
          </div>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        </CardContent>
      </Card>

      {result && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">What the listing says • {result.listing.platform}</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {[['Product', result.listing.productName], ['Price (MRP)', result.listing.mrp], ['Quantity', result.listing.netQuantity], ['Manufacturer', result.listing.manufacturer]].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>
              ))}
              <div className="text-xs text-muted-foreground pt-2 border-t">Captured {new Date(result.listing.extractedAt).toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Listing vs physical package</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              {result.comparison.map((c: any) => (
                <div key={c.field} className={`p-3 rounded-xl border flex justify-between items-center gap-3 ${c.match ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{c.field}</div>
                    <div className="text-xs text-muted-foreground">Listing: <b>{c.listingValue}</b> • Package: <b>{c.packageValue}</b></div>
                  </div>
                  {c.match ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />}
                </div>
              ))}
              <div className={`mt-3 p-4 rounded-xl flex gap-3 ${result.overallStatus === 'MISMATCH' ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                {result.overallStatus === 'MISMATCH' ? <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />}
                <div>
                  <div className="font-semibold text-sm text-foreground">{result.overallStatus === 'MISMATCH' ? 'Mismatch found — the online page and the pack disagree' : 'Everything matches'}</div>
                  <div className="text-xs mt-1 text-muted-foreground">
                    {result.overallStatus === 'MISMATCH' ? 'A price mismatch above the printed MRP is actionable under the rules. Open an inspection to document the physical pack.' : 'This listing is consistent with the package declarations.'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
