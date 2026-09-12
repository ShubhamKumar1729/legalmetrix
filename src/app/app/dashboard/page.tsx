"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ClipboardList, CheckCircle2, AlertTriangle, Clock, 
  TrendingUp, MapPin, Package, ArrowUpRight, ScanLine,
  Eye, FileText
} from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [analyticsRes, inspectionsRes] = await Promise.all([
          fetch('/api/analytics').then(r => r.json()),
          fetch('/api/inspections?limit=10').then(r => r.json()),
        ]);
        if (analyticsRes.success) setData(analyticsRes.data);
        if (inspectionsRes.success) setInspections(inspectionsRes.data.inspections);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}</div>
      <div className="h-96 bg-muted rounded-xl" />
    </div>;
  }

  const kpis = data?.kpis || { totalInspections: 0, compliant: 0, violations: 0, reviewRequired: 0, complianceRate: 0, avgConfidence: 0, pendingReviews: 0, repeatOffenders: 0 };

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enforcement Dashboard</h1>
          <p className="text-sm text-muted-foreground">Legal Metrology • Packaged Commodities Rules, 2011 • Real-time intelligence</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/scan"><Button className="rounded-full"><ScanLine className="w-4 h-4 mr-2" />New Inspection</Button></Link>
          <Link href="/app/reports"><Button variant="outline" className="rounded-full">Reports</Button></Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex justify-between">
              <div><div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total Inspections</div><div className="text-3xl font-bold mt-2">{kpis.totalInspections}</div><div className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +12% vs last month</div></div>
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><ClipboardList className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex justify-between">
              <div><div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Compliant</div><div className="text-3xl font-bold mt-2 text-emerald-600">{kpis.compliant}</div><div className="text-xs text-muted-foreground mt-1">{kpis.complianceRate}% compliance rate</div></div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex justify-between">
              <div><div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Violations</div><div className="text-3xl font-bold mt-2 text-red-600">{kpis.violations}</div><div className="text-xs text-muted-foreground mt-1">Critical & high severity</div></div>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex justify-between">
              <div><div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Review Required</div><div className="text-3xl font-bold mt-2 text-amber-600">{kpis.reviewRequired}</div><div className="text-xs text-muted-foreground mt-1">Avg confidence {kpis.avgConfidence}%</div></div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Inspections Over Time</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.overTime || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="inspections" fill="#0f172a" radius={[4,4,0,0]} />
                  <Bar dataKey="compliant" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="violations" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Compliance Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[
                    { name: 'Compliant', value: kpis.compliant },
                    { name: 'Violations', value: kpis.violations },
                    { name: 'Review', value: kpis.reviewRequired },
                  ]} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                    {[
                      { name: 'Compliant', value: kpis.compliant },
                      { name: 'Violations', value: kpis.violations },
                      { name: 'Review', value: kpis.reviewRequired },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Compliant</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Violation</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Review</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Inspections</CardTitle>
            <Link href="/app/products"><Button variant="ghost" size="sm" className="h-7">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Button></Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                  <tr><th className="text-left p-3 font-medium">Inspection ID</th><th className="text-left p-3 font-medium">Product</th><th className="text-left p-3 font-medium">Manufacturer</th><th className="text-left p-3 font-medium">Score</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Confidence</th><th className="text-left p-3 font-medium">Action</th></tr>
                </thead>
                <tbody>
                  {inspections.map((insp: any) => (
                    <tr key={insp.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{insp.inspectionId}</td>
                      <td className="p-3"><div className="font-medium">{insp.productName}</div><div className="text-xs text-muted-foreground">{insp.brand}</div></td>
                      <td className="p-3 text-xs max-w-[150px] truncate">{insp.manufacturer}</td>
                      <td className="p-3"><span className={`font-bold ${insp.complianceScore >= 80 ? 'text-emerald-600' : insp.complianceScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{insp.complianceScore}</span></td>
                      <td className="p-3"><Badge variant={insp.status === 'COMPLIANT' ? 'compliant' : insp.status === 'NON_COMPLIANT' ? 'violation' : insp.status === 'REVIEW_REQUIRED' ? 'review' : 'secondary'} className="text-[10px]">{insp.status}</Badge></td>
                      <td className="p-3 text-xs">{insp.confidenceSummary?.average || 0}%</td>
                      <td className="p-3"><Link href={`/app/scan/${insp.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3 h-3" /></Button></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Repeat Offenders • Risk</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.repeatOffenders || []).slice(0, 5).map((off: any) => (
              <div key={off.manufacturer} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{off.manufacturer}</div>
                  <div className="text-xs text-muted-foreground">{off.inspections} inspections • {off.violations} violations</div>
                </div>
                <div className="text-right ml-3">
                  <div className={`text-sm font-bold ${off.riskScore > 70 ? 'text-red-600' : off.riskScore > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>{off.riskScore}</div>
                  <div className="text-[10px] text-muted-foreground">RISK</div>
                </div>
              </div>
            ))}
            <Link href="/app/analytics"><Button variant="outline" size="sm" className="w-full rounded-full">View Intelligence</Button></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-slate-900 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3"><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Package className="w-4 h-4" /></div><div className="text-sm font-medium">Violation Categories</div></div>
            <div className="space-y-2">
              {(data?.violationCategories || []).slice(0, 4).map((cat: any) => (
                <div key={cat.name} className="flex justify-between text-sm"><span className="text-slate-400">{cat.name}</span><span className="font-medium">{cat.value}</span></div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">System Health</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>Mock AI Provider</span><Badge variant="compliant" className="text-[10px]">Active • v0.1.0</Badge></div>
              <div className="flex justify-between"><span>Rule Engine</span><Badge variant="compliant" className="text-[10px]">v1.2 Published</Badge></div>
              <div className="flex justify-between"><span>Storage</span><Badge variant="secondary" className="text-[10px]">Local • S3 Ready</Badge></div>
              <div className="flex justify-between"><span>Audit Log</span><Badge variant="secondary" className="text-[10px]">Immutable</Badge></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-600 text-white">
          <CardContent className="p-5">
            <div className="text-sm font-medium mb-2">Demo Mode</div>
            <div className="text-xs text-blue-100 leading-relaxed">Deterministic mock AI ensures reliable jury demo. Real model plugs via AIModelProvider interface without UI rebuild.</div>
            <div className="mt-4 flex gap-2">
              <Badge className="bg-white text-blue-600 border-0 text-[10px]">MockAIProvider</Badge>
              <Badge className="bg-blue-500 text-white border-0 text-[10px]">Pluggable</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
