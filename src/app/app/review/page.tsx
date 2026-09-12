"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit3, CheckCircle2, AlertTriangle, Clock, Filter } from 'lucide-react';
import Link from 'next/link';

export default function ReviewPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/inspections').then(r => r.json()).then(d => {
      if (d.success) setInspections(d.data.inspections.filter((i: any) => i.status === 'REVIEW_REQUIRED' || i.status === 'NON_COMPLIANT' || i.findings?.some((f: any) => f.reviewStatus === 'PENDING')));
    });
  }, []);

  const filtered = inspections.filter(i => {
    if (filter === 'low_conf') return i.confidenceSummary?.lowConfidenceCount > 0;
    if (filter === 'violation') return i.status === 'NON_COMPLIANT';
    if (filter === 'pending') return i.reviewStatus === 'PENDING';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold tracking-tight">Human Review Queue</h1><p className="text-sm text-muted-foreground">AI low-confidence findings routed for human verification • Audit logged</p></div>
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'low_conf', label: 'Low Confidence' },
            { id: 'violation', label: 'Violations' },
            { id: 'pending', label: 'Pending' },
          ].map(f => (
            <Button key={f.id} variant={filter === f.id ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setFilter(f.id)}>{f.label}</Button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filtered.map((insp: any) => (
            <Card key={insp.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <img src={insp.images?.[0]?.url || '/api/placeholder/image?text=Product'} alt="product" className="w-16 h-16 rounded-xl object-cover border" />
                    <div>
                      <div className="font-medium flex items-center gap-2">{insp.productName}<Badge variant={insp.status === 'NON_COMPLIANT' ? 'violation' : 'review'} className="text-[10px]">{insp.status}</Badge></div>
                      <div className="text-xs text-muted-foreground mt-1">{insp.inspectionId} • {insp.brand} • {insp.manufacturer}</div>
                      <div className="flex gap-2 mt-2">
                        {insp.findings?.filter((f: any) => f.status !== 'PASS').slice(0, 3).map((f: any) => (
                          <Badge key={f.id} variant={f.status === 'VIOLATION' ? 'violation' : 'review'} className="text-[10px]">{f.title} • {f.confidence}%</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{insp.complianceScore}/100</div>
                    <div className="text-xs text-muted-foreground">Score</div>
                    <div className="text-xs mt-1">Conf {insp.confidenceSummary?.average}%</div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="text-xs text-muted-foreground flex items-center gap-2"><Clock className="w-3 h-3" />{new Date(insp.createdAt).toLocaleString()} • Assigned to Priya Sharma</div>
                  <div className="flex gap-2">
                    <Link href={`/app/scan/${insp.id}`}><Button size="sm" variant="outline" className="rounded-full h-8"><Eye className="w-3 h-3 mr-1" />Examine Evidence</Button></Link>
                    <Button size="sm" className="rounded-full h-8">Review</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center text-muted-foreground">No items in queue • All caught up</CardContent></Card>}
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Review Stats</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span>My Reviews</span><span className="font-bold">4</span></div>
              <div className="flex justify-between"><span>Overdue</span><span className="font-bold text-red-600">1</span></div>
              <div className="flex justify-between"><span>High Priority</span><span className="font-bold text-amber-600">2</span></div>
              <div className="flex justify-between"><span>Completed Today</span><span className="font-bold text-emerald-600">7</span></div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="font-medium text-sm text-amber-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Review Workflow</div>
              <div className="text-xs text-amber-800 mt-2 leading-relaxed">
                • Accept AI finding → AI_CONFIRMED<br />
                • Correct value → CORRECTED + audit log<br />
                • Reject → HUMAN_CONFIRMED<br />
                • Every edit stores AI value vs corrected value for model improvement
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">AI vs Human</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded-lg bg-muted"><span>AI Value</span><span className="font-mono">GT Road, Ludhiana - 141001</span></div>
              <div className="flex justify-between p-2 rounded-lg bg-blue-50 border border-blue-200"><span>Corrected</span><span className="font-mono">FreshBite Foods Pvt Ltd, GT Road, Ludhiana - 141001, Punjab</span></div>
              <div className="text-muted-foreground mt-2">This delta is logged for future model training</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
