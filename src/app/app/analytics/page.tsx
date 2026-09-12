'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, Explainer, Notice } from '@/components/common/explainer';
import { AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(d => { if (d.success) setData(d.data); }).catch(() => {});
  }, []);

  if (!data) return <div className="space-y-4"><div className="h-8 w-64 bg-muted rounded animate-pulse" /><div className="animate-pulse h-96 bg-muted rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Trends & Risk" inPlainWords="Where problems keep happening. Use this to decide which manufacturers or products to inspect next — not to accuse anyone." />

      <Explainer title="How to read these charts" defaultOpen={false}>
        <p><strong>Bars per day</strong> count inspections; the green part passed, red part had violations. A rising red line means a category or maker is deteriorating.</p>
        <p><strong>Risk score (0–100)</strong> = 20 points per violation + 2 per inspection, so a maker that repeatedly breaks rules climbs fast. Above 70 = inspect first next round.</p>
      </Explainer>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Problems vs passes — last 7 days</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.overTime}><CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" /><XAxis dataKey="date" fontSize={11} tickFormatter={(v: any) => v.slice(5)} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Bar dataKey="violations" name="Problems" fill="#ef4444" radius={[4, 4, 0, 0]} /><Bar dataKey="compliant" name="Passed" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Which product categories are scanned</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.categoryDistribution}><CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Bar dataKey="value" name="Scans" fill="#059669" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Makers with repeated problems</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30"><tr><th className="text-left p-3">Manufacturer</th><th className="text-left p-3">Scans</th><th className="text-left p-3">Problems</th><th className="text-left p-3">Problem rate</th><th className="text-left p-3">Risk score</th><th className="text-left p-3">What to do</th></tr></thead>
              <tbody>
                {data.repeatOffenders.map((r: any) => (
                  <tr key={r.manufacturer} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium">{r.manufacturer}</td>
                    <td className="p-3">{r.inspections}</td>
                    <td className="p-3 text-red-600 font-medium">{r.violations}</td>
                    <td className="p-3">{r.violationRate}%</td>
                    <td className="p-3"><Badge variant={r.riskScore > 70 ? 'violation' : r.riskScore > 40 ? 'review' : 'compliant'} className="text-[10px]" title="20 points per violation + 2 per scan">{r.riskScore}</Badge></td>
                    <td className="p-3 text-xs">{r.riskScore > 70 ? <span className="text-red-700 font-medium inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Inspect first</span> : r.riskScore > 40 ? 'Watch closely' : 'Routine pace'}</td>
                  </tr>
                ))}
                {data.repeatOffenders.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No repeat patterns yet — this fills in as scans accumulate.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-5"><div className="text-xs font-semibold text-muted-foreground">Average AI certainty</div><div className="text-2xl font-bold mt-2">{data.kpis.avgConfidence}%</div><div className="text-xs text-muted-foreground mt-1">Across {data.kpis.totalInspections} inspections — higher means less human checking needed</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-5"><div className="text-xs font-semibold text-muted-foreground">Repeat offenders</div><div className="text-2xl font-bold mt-2 text-red-600">{data.kpis.repeatOffenders}</div><div className="text-xs text-muted-foreground mt-1">Makers needing a field follow-up</div></CardContent></Card>
        <Card className="border-0 shadow-sm bg-stone-900 text-white"><CardContent className="p-5"><div className="text-sm font-medium">Fair-use note</div><div className="text-xs text-stone-300 mt-2 leading-relaxed">Risk scores prioritize inspections — they are not evidence. Each violation must still be proven case by case.</div></CardContent></Card>
      </div>
    </div>
  );
}
