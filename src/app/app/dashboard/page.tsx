'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Package,
  PlusCircle,
  Scale,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useSession } from '@/components/session-provider';
import { formatDate, formatDay, STATUS_LABEL, statusVariant } from '@/lib/labels';
import type { DashboardKPIs, Inspection } from '@/types';

interface AnalyticsResponse {
  kpis: DashboardKPIs;
  hasData: boolean;
  overTime: { date: string; inspections: number; compliant: number; violations: number }[];
  categoryDistribution: { name: string; value: number }[];
}

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b'];

export default function DashboardPage() {
  const { session } = useSession();
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [analyticsBody, inspectionsBody] = await Promise.all([
          fetch('/api/analytics', { cache: 'no-store' }).then((res) => res.json()),
          fetch('/api/inspections?limit=5', { cache: 'no-store' }).then((res) => res.json()),
        ]);
        if (analyticsBody.success) setAnalytics(analyticsBody.data);
        if (inspectionsBody.success) setInspections(inspectionsBody.data.inspections || []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-muted" />
      </div>
    );
  }

  const kpis = analytics?.kpis;
  const hasData = Boolean(analytics?.hasData);

  const distribution = [
    { name: 'Compliant', value: kpis?.compliant ?? 0 },
    { name: 'Violations', value: kpis?.violations ?? 0 },
    { name: 'Review', value: kpis?.reviewRequired ?? 0 },
  ].filter((entry) => entry.value > 0);

  const firstName = session?.user.name?.split(' ')[0] || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {hasData ? `Welcome back${firstName ? `, ${firstName}` : ''}` : 'Welcome to LegalMetrix'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasData
              ? 'Packaged commodity compliance under the Legal Metrology (Packaged Commodities) Rules, 2011.'
              : 'Start your first inspection to begin building your compliance records.'}
          </p>
        </div>
        <Link href="/app/inspections/new">
          <Button size="lg" className="h-12 rounded-full px-6">
            <PlusCircle className="h-4 w-4" /> Start New Inspection
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Inspections', value: kpis?.totalInspections ?? 0, icon: ClipboardList, tone: 'bg-slate-900 text-white' },
          {
            label: 'Compliance Rate',
            value: `${kpis?.complianceRate ?? 0}%`,
            hint: `${kpis?.compliant ?? 0} compliant`,
            icon: CheckCircle2,
            tone: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: 'Review Required',
            value: kpis?.reviewRequired ?? 0,
            hint: `${kpis?.pendingReviews ?? 0} findings awaiting review`,
            icon: Clock,
            tone: 'bg-amber-50 text-amber-600',
          },
          { label: 'Violations', value: kpis?.violations ?? 0, icon: AlertTriangle, tone: 'bg-red-50 text-red-600' },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {kpi.label}
                  </div>
                  <div className="mt-2 text-3xl font-bold">{kpi.value}</div>
                  {kpi.hint && <div className="mt-1 text-xs text-muted-foreground">{kpi.hint}</div>}
                </div>
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${kpi.tone}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Inspections</CardTitle>
        </CardHeader>
        <CardContent>
          {inspections.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No inspections yet"
              description="Create an inspection to capture package images and check them against the configured rules."
              action={
                <Link href="/app/inspections/new">
                  <Button className="rounded-full">
                    <PlusCircle className="h-4 w-4" /> Start New Inspection
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left font-medium">Inspection</th>
                    <th className="p-3 text-left font-medium">Product</th>
                    <th className="hidden p-3 text-left font-medium sm:table-cell">Manufacturer</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="hidden p-3 text-right font-medium sm:table-cell">Score</th>
                    <th className="hidden p-3 text-right font-medium md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((inspection) => (
                    <tr key={inspection.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <Link href={`/app/inspections/${inspection.id}`} className="font-medium hover:underline">
                          {inspection.inspectionNumber}
                        </Link>
                      </td>
                      <td className="p-3">{inspection.productName}</td>
                      <td className="hidden p-3 text-muted-foreground sm:table-cell">{inspection.manufacturer}</td>
                      <td className="p-3">
                        <Badge variant={statusVariant(inspection.status)} className="text-[10px]">
                          {STATUS_LABEL[inspection.status] || inspection.status}
                        </Badge>
                      </td>
                      <td className="hidden p-3 text-right font-medium sm:table-cell">
                        {inspection.scored ? `${inspection.complianceScore}/100` : '—'}
                      </td>
                      <td className="hidden p-3 text-right text-muted-foreground md:table-cell">
                        {formatDate(inspection.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-0 bg-white shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compliance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Analytics will appear after inspections are completed.
              </p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.overTime || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" fontSize={11} tickFormatter={(value: string) => formatDay(value)} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="compliant" name="Compliant" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="violations" name="Violations" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-0 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Compliance Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {distribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No analyzed inspections yet.</p>
              ) : (
                <>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={distribution} dataKey="value" innerRadius={50} outerRadius={80}>
                          {distribution.map((entry, index) => (
                            <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 text-xs">
                    {distribution.map((entry, index) => (
                      <span key={entry.name} className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        {entry.name} ({entry.value})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" /> Products
                </span>
                <span className="font-semibold">{kpis?.products ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ClipboardList className="h-4 w-4" /> Reports generated
                </span>
                <span className="font-semibold">{kpis?.reports ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Scale className="h-4 w-4" /> Rules published
                </span>
                <span className="font-semibold">{kpis?.rulesPublished ?? 0}</span>
              </div>
              {(kpis?.rulesPublished ?? 0) === 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  No rules are published yet, so inspections cannot be scored.{' '}
                  <Link href="/app/rules" className="font-medium underline">
                    Configure rules
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
