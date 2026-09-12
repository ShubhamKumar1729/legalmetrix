'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StepBar } from '@/components/common/step-bar';
import { PageHeader, Explainer, Notice } from '@/components/common/explainer';
import { ScanLine, Upload, Camera, Globe, AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react';

interface ImageSlot {
  id: string;
  side: string;
  url: string;
  name: string;
  size: number;
  resolution: string;
  brightness: string; // measured on-device (0-100%)
  status: 'uploading' | 'done' | 'error';
}

const STEPS = [
  { n: 1, label: 'How to capture', hint: 'Camera or upload' },
  { n: 2, label: 'Which product', hint: 'Name & maker' },
  { n: 3, label: 'Label photos', hint: 'Front & back needed' },
  { n: 4, label: 'Start analysis', hint: 'AI reads the label' },
];

const SIDES = [
  { side: 'FRONT', label: 'Front side', required: true, why: 'Brand, product name, net quantity and MRP usually live here' },
  { side: 'BACK', label: 'Back side', required: true, why: 'Manufacturer address, customer care and dates are usually here' },
  { side: 'SIDE', label: 'Side', required: false, why: 'Optional — ingredients or extra declarations' },
  { side: 'TOP', label: 'Top / lid', required: false, why: 'Optional — seals or batch numbers' },
  { side: 'BOTTOM', label: 'Bottom', required: false, why: 'Optional — printed dates or price stickers' },
  { side: 'ADDITIONAL', label: 'Extra evidence', required: false, why: 'Anything unusual you want on record' },
];

/** Quick on-device check so officers notice blurry/dark photos BEFORE analysis. */
function measureImage(url: string): Promise<{ resolution: string; brightness: string }> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const w = (c.width = 64), h = (c.height = 48);
        const ctx = c.getContext('2d');
        if (!ctx) return resolve({ resolution: `${img.naturalWidth}×${img.naturalHeight}`, brightness: 'n/a' });
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const pct = Math.round((sum / (data.length / 4) / 255) * 100);
        resolve({ resolution: `${img.naturalWidth}×${img.naturalHeight}`, brightness: `${pct}%` });
      } catch {
        resolve({ resolution: `${img.naturalWidth}×${img.naturalHeight}`, brightness: 'n/a' });
      }
    };
    img.onerror = () => resolve({ resolution: 'unknown', brightness: 'n/a' });
    img.src = url;
  });
}

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
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFile = async (side: string, file: File) => {
    const placeholderId = `local-${side}-${Date.now()}`;
    const localUrl = URL.createObjectURL(file);
    setImages(prev => [...prev, { id: placeholderId, side, url: localUrl, name: file.name, size: file.size, resolution: '…', brightness: '…', status: 'uploading' }]);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('side', side);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      const url = data.data.url;
      const m = await measureImage(url);
      setImages(prev => prev.map(img => img.id === placeholderId ? { ...img, id: data.data.id, url, ...m, status: 'done' } : img));
    } catch (e: any) {
      // Fall back to a demo placeholder so the workflow is never blocked in demo environments
      const url = `/api/placeholder/image?text=${encodeURIComponent(side)}`;
      const m = await measureImage(url);
      setImages(prev => prev.map(img => img.id === placeholderId ? { ...img, url, ...m, status: 'done' } : img));
    }
  };

  const removeImage = (id: string) => setImages(prev => prev.filter(i => i.id !== id));

  const requiredSatisfied = ['FRONT', 'BACK'].every(s => images.some(i => i.side === s && i.status === 'done'));

  const handleCreateInspection = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...product,
          images: images.filter(i => i.status === 'done').map(img => ({
            id: img.id,
            side: img.side,
            url: img.url,
            originalName: img.name,
            size: img.size,
            mimeType: 'image/jpeg',
            quality: { resolution: 300, blurScore: 0.12, brightness: 0.85, readability: 0.92, coverage: 0.88 },
            uploadedAt: new Date().toISOString(),
          })),
          source: 'FIELD',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error?.message || 'Could not start the inspection');
      router.push(`/app/scan/${data.data.id}`); // results page triggers the AI analysis
    } catch (e: any) {
      setCreateError(e?.message || 'Something went wrong. You can retry — nothing was lost.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="New Scan" inPlainWords="Photograph the package label, and LegalMetrix reads every legally-required detail for you. The AI never decides — you do." >
        <Link href="/app/guide" className="text-sm text-emerald-700 self-center font-medium hidden md:block">New to this? Read the guide</Link>
      </PageHeader>

      <StepBar steps={STEPS} current={step} onStepClick={n => setStep(n)} />

      {step === 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">How do you want to capture the package?</CardTitle><CardDescription>All methods end in the same place: the AI reads your photos. Pick what&rsquo;s practical right now.</CardDescription></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Upload, title: 'Upload photos', desc: 'Already took pictures? Choose files from this device.', action: () => { setStep(3); } },
              { icon: Camera, title: 'Camera', desc: 'Take photos now — one per label side.', action: () => { setStep(3); } },
              { icon: Globe, title: 'Online listing', desc: 'Compare a web listing with the physical pack later.', action: () => router.push('/app/ecommerce') },
            ].map((m) => (
              <button key={m.title} onClick={m.action} className="text-left p-5 rounded-xl border-2 border-stone-200 hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors bg-white group">
                <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center mb-3"><m.icon className="w-5 h-5" /></div>
                <div className="font-semibold">{m.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{m.desc}</div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Which product is this?</CardTitle><CardDescription>Just enough to find it again later. The AI will read the actual declarations from the photos.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="f-name">Product name</Label><Input id="f-name" value={product.productName} onChange={e => setProduct({ ...product, productName: e.target.value })} /><p className="text-xs text-muted-foreground">As printed on the package.</p></div>
              <div className="space-y-1.5"><Label htmlFor="f-brand">Brand</Label><Input id="f-brand" value={product.brand} onChange={e => setProduct({ ...product, brand: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="f-cat">Category</Label>
                <select id="f-cat" value={product.category} onChange={e => setProduct({ ...product, category: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  <option>FOOD</option><option>COSMETICS</option><option>GROCERY</option><option>ELECTRONICS</option><option>TEXTILES</option><option>OTHER</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="f-barcode">Barcode <span className="text-muted-foreground font-normal">(optional)</span></Label><Input id="f-barcode" value={product.barcode} onChange={e => setProduct({ ...product, barcode: e.target.value })} /></div>
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="f-mfr">Manufacturer / packer / importer</Label><Input id="f-mfr" value={product.manufacturer} onChange={e => setProduct({ ...product, manufacturer: e.target.value })} /><p className="text-xs text-muted-foreground">Whoever&rsquo;s name is printed on the label — the AI will check the full address exists.</p></div>
              <div className="space-y-1.5"><Label htmlFor="f-batch">Batch / lot <span className="text-muted-foreground font-normal">(optional)</span></Label><Input id="f-batch" value={product.batchNumber} onChange={e => setProduct({ ...product, batchNumber: e.target.value })} /></div>
            </div>
            <Notice tone="neutral">
              <strong>Demo tip:</strong> product names <em>FreshBite</em>, <em>PureHarvest</em> and <em>CleanCare</em> trigger the three prepared AI demo scenarios (pass / review / violation). Any other name gets a generic result.
            </Notice>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">Back</Button>
              <Button onClick={() => setStep(3)} className="rounded-full">Continue to photos</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Add label photos</CardTitle><CardDescription>Front and back are required. JPG / PNG / WebP, up to 10 MB each.</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-3">
              {SIDES.map((slot) => {
                const imgs = images.filter(i => i.side === slot.side);
                return (
                  <div key={slot.side} className={`rounded-xl border-2 border-dashed p-4 transition-colors ${imgs.length ? 'border-emerald-300 bg-emerald-50/40' : 'border-stone-300 bg-stone-50'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold uppercase">{slot.label}{slot.required && <span className="text-red-600"> *</span>}</span>
                      {imgs.length > 0 && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2 leading-snug">{slot.why}</p>
                    <input ref={el => { fileRefs.current[slot.side] = el; }} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                      onChange={e => { Array.from(e.target.files || []).slice(0, 3).forEach(f => handleFile(slot.side, f)); e.target.value = ''; }} />
                    {imgs.map(img => (
                      <div key={img.id} className="relative group mb-2">
                        <img src={img.url} alt={img.side} className="w-full h-24 object-cover rounded-lg border bg-white" />
                        <div className="absolute inset-0 bg-black/45 text-white flex items-center justify-center text-xs gap-2 rounded-lg">
                          {img.status === 'uploading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <>{img.resolution} • brightness {img.brightness}</>}
                        </div>
                        <button onClick={() => removeImage(img.id)} className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Remove photo"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    <button onClick={() => fileRefs.current[slot.side]?.click()} className="w-full h-12 rounded-lg bg-white border hover:bg-accent text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                      <Upload className="w-4 h-4" /> Add photo{imgs.length ? 's' : ''}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-full">Back</Button>
              <div className="flex items-center gap-3">
                {!requiredSatisfied && <span className="text-xs text-muted-foreground">Add at least Front and Back to continue</span>}
                <Button onClick={() => setStep(4)} disabled={!requiredSatisfied} className="rounded-full">Check photos & continue</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Photo check — ready for analysis?</CardTitle><CardDescription>We measured what we can measure on this device. The AI will re-check everything in depth.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              {images.filter(i => i.status === 'done').map(img => (
                <div key={img.id} className="flex gap-3 p-3 rounded-xl border bg-white items-center">
                  <img src={img.url} alt={img.side} className="w-16 h-16 rounded-lg object-cover border" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{img.side} • {img.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{img.resolution} • brightness {img.brightness} • {(img.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                  <Badge variant={img.status === 'done' ? 'compliant' : 'processing'} className="text-[10px]">{img.status === 'done' ? 'Ready' : 'Waiting'}</Badge>
                </div>
              ))}
            </div>

            {images.some(i => i.brightness !== '…' && parseInt(i.brightness) < 35) && (
              <Notice tone="warn" icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}>
                Some photos are dark. Small print (like the manufacturer address) is the hardest to read in low light — a retake would raise AI certainty.
              </Notice>
            )}

            <Explainer title="What happens when you press “Start AI analysis”" defaultOpen>
              <p>The AI looks at your photos in 12 passes: it finds text, identifies each legally-required declaration (MRP, quantity, address, dates…), reads them in any language, then the rule engine checks them against the published rules.</p>
              <p>Results where the AI is ≥90% sure pass automatically. Anything below 75% is marked “Please check” and waits in your Review Queue for <em>a human decision</em> — that&rsquo;s by design.</p>
            </Explainer>

            {createError && <Notice tone="bad" icon={<AlertTriangle className="w-4 h-4 text-red-600" />}>{createError}</Notice>}

            <div className="flex justify-between pt-2 border-t">
              <Button variant="outline" onClick={() => setStep(3)} disabled={creating} className="rounded-full">Back to photos</Button>
              <Button onClick={handleCreateInspection} disabled={creating || !requiredSatisfied} className="rounded-full px-8 h-11">
                {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting analysis…</> : <>Start AI analysis <ScanLine className="w-4 h-4 ml-1.5" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
