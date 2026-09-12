"use client";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Wifi, WifiOff, Clock, Package } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function MobilePage() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 max-w-[400px] mx-auto">
      <div className="flex justify-between items-center mb-6"><h1 className="font-bold">Field Inspection</h1><Badge variant={online ? 'compliant' : 'violation'} className="text-[10px]">{online ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}{online ? 'Online' : 'Offline'}</Badge></div>

      <Card className="border-0 shadow-sm bg-slate-900 text-white mb-4"><CardContent className="p-6 text-center"><div className="w-20 h-20 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-4"><Camera className="w-10 h-10" /></div><div className="font-bold text-lg">Capture Package</div><div className="text-sm text-slate-400 mt-1">Front • Back • Side • Evidence</div><Button className="w-full mt-6 rounded-full bg-white text-slate-900 hover:bg-slate-100 h-12">Open Camera</Button></CardContent></Card>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><Upload className="w-6 h-6 mx-auto mb-2" /><div className="text-sm font-medium">Upload</div><div className="text-xs text-muted-foreground">Gallery</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><Package className="w-6 h-6 mx-auto mb-2" /><div className="text-sm font-medium">Batch</div><div className="text-xs text-muted-foreground">Multiple</div></CardContent></Card>
      </div>

      <Card className="border-0 shadow-sm mb-4"><CardContent className="p-4"><div className="flex justify-between items-center"><span className="text-sm font-medium">Sync Queue</span><Badge variant="secondary" className="text-[10px]">3 pending</Badge></div><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between p-2 rounded-lg bg-amber-50 border border-amber-200"><span>LM-2026-001042 • FreshBite</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />Pending Sync</span></div><div className="flex justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200"><span>LM-2026-001043 • PureHarvest</span><span>Synced</span></div><div className="flex justify-between p-2 rounded-lg bg-blue-50 border border-blue-200"><span>LM-2026-001044 • CleanCare</span><span>Syncing...</span></div></div></CardContent></Card>

      <div className="text-xs text-muted-foreground text-center leading-relaxed">Offline-first architecture • Local draft queue • Sync when online • Geo-tagged evidence • PWA ready<br />Capture → Store local → Queue sync → Sync when online</div>
    </div>
  );
}
