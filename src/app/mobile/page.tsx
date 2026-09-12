'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Wifi, WifiOff, Clock, Package, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Field-first capture screen: big camera button, minimal chrome,
 * and an honest view of what&rsquo;s still queued on this device.
 */
export default function MobilePage() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 p-4 max-w-[400px] mx-auto">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="font-bold text-lg leading-tight">Field capture</h1>
          <p className="text-xs text-muted-foreground">Works offline — syncs when you&apos;re back</p>
        </div>
        <Badge variant={online ? 'compliant' : 'violation'} className="text-[10px]" title={online ? 'Server reachable' : 'Photos stay on this device until you reconnect'}>
          {online ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}{online ? 'Online' : 'Offline'}
        </Badge>
      </div>

      <Link href="/app/scan">
        <Card className="border-0 shadow-sm bg-stone-900 text-white mb-4 hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-600 flex items-center justify-center mb-4"><Camera className="w-10 h-10" /></div>
            <div className="font-bold text-lg">Take package photos</div>
            <div className="text-sm text-stone-300 mt-1">Front • Back • any side that matters</div>
            <div className="w-full mt-6 rounded-full bg-emerald-600 border border-emerald-500 h-12 flex items-center justify-center text-sm font-semibold">Open camera flow</div>
          </CardContent>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><Upload className="w-6 h-6 mx-auto mb-2 text-emerald-700" /><div className="text-sm font-medium">From gallery</div><div className="text-xs text-muted-foreground">pick saved photos</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><Package className="w-6 h-6 mx-auto mb-2 text-emerald-700" /><div className="text-sm font-medium">Batch of packs</div><div className="text-xs text-muted-foreground">multiple products</div></CardContent></Card>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex justify-between items-center"><span className="text-sm font-medium">Waiting to sync</span><Badge variant="secondary" className="text-[10px]">3 items</Badge></div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-amber-50 border border-amber-200"><span>LM-2026-001042 • FreshBite</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />waiting for network</span></div>
            <div className="flex justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200"><span>LM-2026-001043 • PureHarvest</span><span className="text-emerald-700">saved ✓</span></div>
            <div className="flex justify-between p-2 rounded-lg bg-stone-100 border border-stone-300"><span>LM-2026-001044 • CleanCare</span><span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" />syncing…</span></div>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        Photos are stored on this device first, then uploaded with GPS location so evidence can&apos;t be swapped later. This is a preview of the offline PWA mode.
      </p>
    </div>
  );
}
