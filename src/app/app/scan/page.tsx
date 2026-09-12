"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScanLine, Upload, Camera, Barcode, Globe, Package, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ScanPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState({
    productName: 'FreshBite Premium Biscuits',
    brand: 'FreshBite',
    category: 'FOOD',
    manufacturer: 'FreshBite Foods Pvt Ltd, Ludhiana',
    barcode: '8901234567890',
    batchNumber: 'FB-2026-08-A',
  });
  const [images, setImages] = useState<{ id: string; side: string; url: string; name: string }[]>([
    { id: 'img-front', side: 'FRONT', url: '/api/placeholder/image?text=FreshBite+Front', name: 'front.jpg' },
    { id: 'img-back', side: 'BACK', url: '/api/placeholder/image?text=FreshBite+Back', name: 'back.jpg' },
  ]);
  const [creating, setCreating] = useState(false);

  const handleCreateInspection = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...product,
          images: images.map(img => ({
            id: img.id,
            side: img.side,
            url: img.url,
            originalName: img.name,
            size: 2400000,
            mimeType: 'image/jpeg',
            quality: { resolution: 300, blurScore: 0.12, brightness: 0.85, readability: 0.92, coverage: 0.88 },
            uploadedAt: new Date().toISOString(),
          })),
          source: 'FIELD',
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Immediately trigger AI analysis
        await fetch(`/api/inspections/${data.data.id}/analyze`, { method: 'POST' });
        router.push(`/app/scan/${data.data.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const addImage = (side: string) => {
    const id = `img-${Date.now()}`;
    setImages([...images, { id, side, url: `/api/placeholder/image?text=${side}`, name: `${side.toLowerCase()}.jpg` }]);
  };

  const removeImage = (id: string) => setImages(images.filter(i => i.id !== id));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Product Inspection</h1>
        <p className="text-sm text-muted-foreground">Capture → Quality Check → AI Analysis → Rule Validation → Review → Report</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'Capture Method' },
          { n: 2, label: 'Product Info' },
          { n: 3, label: 'Upload Images' },
          { n: 4, label: 'Quality Check' },
        ].map((s) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s.n ? 'bg-slate-900 text-white' : 'bg-muted text-muted-foreground'}`}>{s.n}</div>
            <span className={`text-sm ${step >= s.n ? 'font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
            {s.n < 4 && <div className={`w-12 h-0.5 ${step > s.n ? 'bg-slate-900' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle>Select Capture Method</CardTitle><CardDescription>Choose how you want to capture package evidence</CardDescription></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Camera, title: 'Camera', desc: 'Use device camera for field capture', action: () => setStep(2) },
              { icon: Upload, title: 'Upload Images', desc: 'Upload multiple package sides', action: () => setStep(2), primary: true },
              { icon: Barcode, title: 'Barcode Scan', desc: 'Scan barcode + upload images', action: () => setStep(2) },
              { icon: Globe, title: 'E-commerce Listing', desc: 'Analyze online listing vs package', action: () => setStep(2) },
              { icon: Package, title: 'Batch Upload', desc: 'Multiple products at once', action: () => setStep(2) },
            ].map((m) => (
              <button key={m.title} onClick={m.action} className={`text-left p-5 rounded-xl border-2 transition-all ${m.primary ? 'border-slate-900 bg-slate-50' : 'border-muted hover:border-slate-200 bg-white'}`}>
                <m.icon className="w-6 h-6 mb-3" />
                <div className="font-medium">{m.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle>Product Information</CardTitle><CardDescription>Enter basic product details for traceability</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Product Name *</Label><Input value={product.productName} onChange={e => setProduct({ ...product, productName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Brand *</Label><Input value={product.brand} onChange={e => setProduct({ ...product, brand: e.target.value })} /></div>
              <div className="space-y-2"><Label>Category *</Label><select value={product.category} onChange={e => setProduct({ ...product, category: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option>FOOD</option><option>COSMETICS</option><option>GROCERY</option><option>ELECTRONICS</option><option>TEXTILES</option></select></div>
              <div className="space-y-2"><Label>Barcode</Label><Input value={product.barcode} onChange={e => setProduct({ ...product, barcode: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Manufacturer / Packer / Importer *</Label><Input value={product.manufacturer} onChange={e => setProduct({ ...product, manufacturer: e.target.value })} /></div>
              <div className="space-y-2"><Label>Batch / Lot</Label><Input value={product.batchNumber} onChange={e => setProduct({ ...product, batchNumber: e.target.value })} /></div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">Back</Button>
              <Button onClick={() => setStep(3)} className="rounded-full">Continue to Images</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle>Upload Package Images</CardTitle><CardDescription>Front, Back, Side, Top, Bottom, Additional evidence • Supports JPG, PNG, WebP • Max 10 images</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { side: 'FRONT', label: 'Front Side *', required: true },
                { side: 'BACK', label: 'Back Side *', required: true },
                { side: 'SIDE', label: 'Side' },
                { side: 'TOP', label: 'Top' },
                { side: 'BOTTOM', label: 'Bottom' },
                { side: 'ADDITIONAL', label: 'Additional Evidence' },
              ].map((slot) => {
                const hasImage = images.some(i => i.side === slot.side);
                return (
                  <div key={slot.side} className={`rounded-xl border-2 border-dashed p-4 ${hasImage ? 'border-emerald-200 bg-emerald-50/50' : 'border-muted bg-muted/20'}`}>
                    <div className="flex justify-between items-center mb-2"><span className="text-xs font-semibold uppercase">{slot.label}</span>{hasImage && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}</div>
                    {hasImage ? (
                      <div className="space-y-2">
                        {images.filter(i => i.side === slot.side).map(img => (
                          <div key={img.id} className="relative group">
                            <img src={img.url} alt={img.side} className="w-full h-24 object-cover rounded-lg border" />
                            <button onClick={() => removeImage(img.id)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button onClick={() => addImage(slot.side)} className="w-full h-24 rounded-lg bg-white border flex flex-col items-center justify-center gap-1 hover:bg-accent">
                        <Upload className="w-5 h-5" /><span className="text-xs">Upload {slot.side}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-full">Back</Button>
              <Button onClick={() => setStep(4)} className="rounded-full">Quality Check</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle>Image Quality Check</CardTitle><CardDescription>AI pre-check for resolution, blur, brightness, readability</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              {images.map((img) => (
                <div key={img.id} className="rounded-xl border bg-white p-4 flex gap-4">
                  <img src={img.url} alt={img.side} className="w-20 h-20 rounded-lg object-cover border" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between"><span className="text-sm font-medium">{img.side}</span><Badge variant="compliant" className="text-[10px]">Good</Badge></div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Resolution</span><span className="font-medium">300 DPI ✓</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Blur</span><span className="font-medium">0.12 (low) ✓</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Readability</span><span className="font-medium">92% ✓</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Coverage</span><span className="font-medium">88% ✓</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm"><div className="font-medium text-amber-900">Quality Advisory</div><div className="text-amber-700 mt-1">Manufacturer address font size near minimum threshold (1mm). AI will flag for review. Consider retaking back side with better lighting if possible.</div></div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-full">Back</Button>
              <Button onClick={handleCreateInspection} disabled={creating} className="rounded-full px-8 h-11">
                {creating ? 'Creating Inspection...' : 'Start AI Analysis'} <ScanLine className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
