'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice } from '@/components/common/explainer';
import { StatusBadge, ConfidenceBadge } from '@/components/common/status-badges';
import {
  ClipboardList, CheckCircle2, AlertTriangle, Clock,
  ScanLine, Eye, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#059669', '#dc2626', '#f59e0b']; // ok / problem / needs review — no blue

function Kpi({ label, meaning, value, note, icon, tone }: { label: string; meaning: string; value: string | number; note?: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="border-0 shadow-sm bg-white" title={meaning}>
      <CardContent className="p-5">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-muted-foreground">{label}</div>
            <div className={`text-3xl font-bold mt-2 ${tone}`}>{value}</div>
            {note && <div className="text-xs text-muted-foreground mt-1">{note}</div>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tone.replace('text-', 'bg-').replace('-600', '-50').replace('-700', '-50')}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [analyticsRes, inspectionsRes, aiRes] = await Promise.all([
          fetch('/api/analytics').then(r => r.json()),
          fetch('/api/inspections?limit=8').then(r => r.json()),
          fetch('/api/ai/status').then(r => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (analyticsRes.success) setData(analyticsRes.data);
        else setError(analyticsRes.error?.message || 'Could not load dashboard data.');
        if (inspectionsRes.success) setInspections(inspectionsRes.data.inspections);
        if (aiRes?.success) setAiStatus(aiRes.data);
      } catch (e) {
        setError('Could not load dashboard data. Refresh to try again.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}</div>
        <div className="h-96 bg-muted rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <Notice tone="bad" icon={<AlertTriangle className="w-4 h-4" />}><strong>Something went wrong.</strong> {error} <Link href="/login" className="underline">Sign in again</Link></Notice>;
  }

  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" inPlainWords="Everything your team inspected, at a glance. Red and amber numbers are where attention is needed.">
        <Link href="/app/guide"><Button variant="outline" className="rounded-full">New here? Read the guide</Button></Link>
        <Link href="/app/scan"><Button className="rounded-full"><ScanLine className="w-4 h-4 mr-2" />New Scan</Button></Link>
      </PageHeader>

      {/* KPIs — plain question wording so nobody has to learn the jargon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Scans completed" meaning="All inspections recorded, good or bad." value={kpis.totalInspections ?? 0} note="All time" icon={<ClipboardList className="w-5 h-5 text-stone-600" />} tone="text-stone-900" />
        <Kpi label="Passed cleanly" meaning="Labels had everything the law requires." value={kpis.compliant ?? 0} note={`${kpis.complianceRate ?? 0}% of all scans`} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} tone="text-emerald-600" />
        <Kpi label="Problems found" meaning="Mandatory declarations missing or wrong." value={kpis.violations ?? 0} note="May need enforcement action" icon={<AlertTriangle className="w-5 h-5 text-red-600" />} tone="text-red-600" />
        <Kpi label="Waiting on a human" meaning="The AI was unsure — these need someone's decision." value={kpis.reviewRequired ?? 0} note={`AI certainty avg ${kpis.avgConfidence ?? 0}%`} icon={<Clock className="w-5 h-5 text-amber-600" />} tone="text-amber-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Scans over the last 7 days</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.overTime || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="date" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="inspections" name="All scans" fill="#1c1917" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="compliant" name="Passed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="violations" name="Problems" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Outcome mix</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[
                    { name: 'Passed', value: kpis.compliant || 0 },
                    { name: 'Problems', value: kpis.violations || 0 },
                    { name: 'Needs review', value: kpis.reviewRequired || 0 },
                  ]} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                    {[0, 1, 2].map(i => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Passed</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Problems</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Needs review</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Latest scans</CardTitle>
            <Link href="/app/products"><Button variant="ghost" size="sm" className="h-7">All products <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                  <tr>
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-left p-3 font-medium">Manufacturer</th>
                    <th className="text-left p-3 font-medium">Score</th>
                    <th className="text-left p-3 font-medium">Outcome</th>
                    <th className="text-left p-3 font-medium">AI certainty</th>
                    <th className="text-right p-3 font-medium">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((insp: any) => (
                    <tr key={insp.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => window.location.assign(`/app/scan/${insp.id}`)}>
                      <td className="p-3"><div className="font-medium">{insp.productName}</div><div className="text-xs text-muted-foreground font-mono">{insp.inspectionId}</div></td>
                      <td className="p-3 text-xs max-w-[150px] truncate">{insp.manufacturer}</td>
                      <td className="p-3">
                        <span className={`font-bold ${insp.complianceScore >= 80 ? 'text-emerald-600' : insp.complianceScore >= 50 ? 'text-amber-600' : 'text-red-600'}`} title="0–100 — higher means fewer problems">{insp.complianceScore}</span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </td>
                      <td className="p-3"><StatusBadge status={insp.status} /></td>
                      <td className="p-3"><ConfidenceBadge value={insp.confidenceSummary?.average || 0} /></td>
                      <td className="p-3 text-right"><Eye className="w-4 h-4 inline text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Repeat offenders</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              {(data?.repeatOffenders || []).slice(0, 4).map((off: any) => (
                <div key={off.manufacturer} className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-white">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{off.manufacturer}</div>
                    <div className="text-xs text-muted-foreground">{off.violations} problem{off.violations === 1 ? '' : 's'} in {off.inspections} scans</div>
                  </div>
                  <div className="text-right flex-shrink-0" title="0–100 — higher risk should be inspected first">
                    <div className={`text-sm font-bold ${off.riskScore > 70 ? 'text-red-600' : off.riskScore > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>{off.riskScore}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">risk</div>
                  </div>
                </div>
              ))}
              {(data?.repeatOffenders || []).length === 0 && <div className="text-sm text-muted-foreground">No repeat offenders detected yet.</div>}
              <Link href="/app/analytics"><Button variant="outline" size="sm" className="w-full rounded-full">See all trends</Button></Link>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">System status</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground" title="The vision model reading package photos. Swap for a real model in Settings.">AI model</span>
                <Badge variant={aiStatus?.activeProvider === 'real' ? 'compliant' : 'secondary'} className="text-[10px] max-w-[55%] truncate">
                  {aiStatus ? `${aiStatus.activeProvider} • ${aiStatus.modelVersion}` : 'checking…'}
                </Badge>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Rules checklist</span>
                <Badge variant="compliant" className="text-[10px]">v1.2 published</Badge>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Evidence storage</span>
                <Badge variant="secondary" className="text-[10px]">Local • S3-ready</Badge>
              </div>
              <Link href="/app/admin/settings"><Button variant="ghost" size="sm" className="w-full mt-1">AI & system settings <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
