"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(d => { if (d.success) setData(d.data); });
  }, []);

  if (!data) return <div className="animate-pulse h-96 bg-muted rounded-xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Enforcement Intelligence • Analytics</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Violation Trends</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.overTime}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="date" fontSize={11} tickFormatter={(v: any) => v.slice(5)} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="violations" fill="#ef4444" radius={[4,4,0,0]} /><Bar dataKey="compliant" fill="#10b981" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Category Distribution</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.categoryDistribution}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="value" fill="#0f172a" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Repeat Offender Detection • Risk Scoring</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30"><tr><th className="text-left p-3">Manufacturer</th><th className="text-left p-3">Inspections</th><th className="text-left p-3">Violations</th><th className="text-left p-3">Rate</th><th className="text-left p-3">Risk Score</th><th className="text-left p-3">Trend</th><th className="text-left p-3">Priority</th></tr></thead>
              <tbody>
                {data.repeatOffenders.map((r: any) => (
                  <tr key={r.manufacturer} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium">{r.manufacturer}</td>
                    <td className="p-3">{r.inspections}</td>
                    <td className="p-3 text-red-600 font-medium">{r.violations}</td>
                    <td className="p-3">{r.violationRate}%</td>
                    <td className="p-3"><Badge variant={r.riskScore > 70 ? 'violation' : r.riskScore > 40 ? 'review' : 'compliant'} className="text-[10px]">{r.riskScore}</Badge></td>
                    <td className="p-3">{r.trend}</td>
                    <td className="p-3"><Badge variant={r.riskScore > 70 ? 'violation' : 'secondary'} className="text-[10px]">{r.riskScore > 70 ? 'High Risk' : r.riskScore > 40 ? 'Medium' : 'Low'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-slate-900 text-white"><CardContent className="p-5"><div className="text-sm font-medium">Enforcement Prioritization</div><div className="text-xs text-slate-400 mt-2 leading-relaxed">High risk manufacturers flagged based on repeated violations, severity, frequency, recent violations. Configurable risk formula stored separately from UI.</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Avg Confidence</div><div className="text-2xl font-bold mt-2">{data.kpis.avgConfidence}%</div><div className="text-xs text-muted-foreground mt-1">Across {data.kpis.totalInspections} inspections</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Repeat Offenders</div><div className="text-2xl font-bold mt-2 text-red-600">{data.kpis.repeatOffenders}</div><div className="text-xs text-muted-foreground mt-1">Require field follow-up</div></CardContent></Card>
      </div>
    </div>
  );
}
