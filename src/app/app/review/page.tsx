'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader, Explainer, Notice } from '@/components/common/explainer';
import { StatusBadge } from '@/components/common/status-badges';
import { plainFieldName } from '@/lib/ui/labels';
import { Eye, ThumbsUp, ThumbsDown, Edit3, Loader2, ShieldQuestion, Inbox } from 'lucide-react';
import Link from 'next/link';

/**
 * Review Queue — the human half of "AI-assisted, human-decided".
 * Each item lists the open findings; quick decisions call the same API
 * the evidence viewer uses, so a decision anywhere updates everywhere.
 */
export default function ReviewPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [openCorrector, setOpenCorrector] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      setCanReview(!!u && ['REVIEWER', 'SUPER_ADMIN'].includes(u.role));
    } catch {}
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inspections');
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d?.error?.message || 'Could not load the queue');
      setInspections(d.data.inspections.filter((i: any) =>
        i.status === 'REVIEW_REQUIRED' || i.status === 'NON_COMPLIANT' || i.findings?.some((f: any) => f.reviewStatus === 'PENDING')));
    } catch (e: any) {
      setError(e.message || 'Could not load the queue.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function decide(inspId: string, findingId: string, decision: 'ACCEPT' | 'REJECT' | 'CORRECT', correctedValue?: string) {
    const key = `${findingId}:${decision}`;
    setBusy(key);
    setError('');
    try {
      const res = await fetch(`/api/inspections/${inspId}/findings/${findingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, correctedValue }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d?.error?.message || 'Decision failed');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(null); setOpenCorrector(null); }
  }

  const filtered = inspections.filter(i => {
    if (filter === 'low_conf') return i.confidenceSummary?.lowConfidenceCount > 0;
    if (filter === 'violation') return i.status === 'NON_COMPLIANT';
    if (filter === 'pending') return i.findings?.some((f: any) => f.reviewStatus === 'PENDING');
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        inPlainWords="The AI marks anything it isn't fully sure about and drops it here. You decide — your decision is what counts, not the model's."
      >
        {(['all', 'pending', 'low_conf', 'violation'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setFilter(f)}>
            {{ all: 'Everything', pending: 'Waiting for decision', low_conf: 'AI was unsure', violation: 'Rule broken' }[f]}
          </Button>
        ))}
      </PageHeader>

      <Explainer title="How to work this queue (30 seconds)" defaultOpen>
        <p><strong>1. Open</strong> an item and look at the photo evidence the AI highlighted. <strong>2. Agree?</strong> Press “I agree”. <strong>3. The AI misread?</strong> Either type the correct value (“Correct”) or throw out the finding (“Reject”).</p>
        <p>Every button here stores the AI value next to your value — that delta is how the model learns. Nothing here is final until the report is generated.</p>
      </Explainer>

      {error && <Notice tone="bad" icon={<ShieldQuestion className="w-4 h-4 text-red-600" />}>{error}</Notice>}
      {!canReview && <Notice tone="warn">You can review the evidence, but decisions are reserved for <strong>Reviewers</strong> and <strong>Admins</strong>. Sign in as reviewer@gov.in (Gov@2026) to try deciding.</Notice>}

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading queue…</p>}
        {filtered.map((insp: any) => {
          const open = (insp.findings || []).filter((f: any) => f.reviewStatus === 'PENDING' && f.status !== 'PASS');
          return (
            <Card key={insp.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap justify-between gap-4">
                  <div className="flex gap-4 min-w-0">
                    <img src={insp.images?.[0]?.url || '/api/placeholder/image?text=Product'} alt="Product" className="w-16 h-16 rounded-xl object-cover border bg-stone-50" />
                    <div className="min-w-0">
                      <div className="font-semibold flex flex-wrap items-center gap-2">{insp.productName} <StatusBadge status={insp.status} className="text-[10px]" /></div>
                      <div className="text-xs text-muted-foreground mt-0.5">{insp.inspectionId} • {insp.manufacturer}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" title="0–100, higher is better">{insp.complianceScore}/100</div>
                    <div className="text-xs text-muted-foreground">avg certainty {insp.confidenceSummary?.average ?? 0}%</div>
                    <Link href={`/app/scan/${insp.id}`}><Button size="sm" variant="outline" className="rounded-full h-7 mt-2"><Eye className="w-3 h-3 mr-1" />Open evidence</Button></Link>
                  </div>
                </div>

                {open.length > 0 ? (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {open.map((f: any) => (
                      <div key={f.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-stone-50 border">
                        <div className="flex-1 min-w-[220px]">
                          <div className="text-sm font-medium">{f.title} <Badge variant={f.status === 'VIOLATION' ? 'violation' : 'review'} className="text-[10px] ml-1">{f.status === 'VIOLATION' ? 'Rule broken' : 'Please check'}</Badge></div>
                          <div className="text-xs text-muted-foreground mt-0.5">AI read: <span className="font-mono">{f.detectedValue || `nothing for ${plainFieldName((f.declarationType || '').toLowerCase())}`}</span> • certainty {f.confidence}%</div>
                        </div>
                        {openCorrector === f.id ? (
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Input autoFocus value={corrections[f.id] || ''} onChange={e => setCorrections({ ...corrections, [f.id]: e.target.value })} placeholder="Correct value" className="h-8 w-52" />
                            <Button size="sm" className="rounded-full h-8" disabled={!corrections[f.id]?.trim() || !!busy} onClick={() => decide(insp.id, f.id, 'CORRECT', corrections[f.id]?.trim())}>
                              {busy === `${f.id}:CORRECT` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => setOpenCorrector(null)}>✕</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" className="rounded-full h-8 text-xs border-emerald-200 text-emerald-800 hover:bg-emerald-50" disabled={!canReview || !!busy} onClick={() => decide(insp.id, f.id, 'ACCEPT')}>
                              {busy === `${f.id}:ACCEPT` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ThumbsUp className="w-3 h-3 mr-1" />}I agree
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" disabled={!canReview || !!busy} onClick={() => setOpenCorrector(f.id)}><Edit3 className="w-3 h-3 mr-1" />Correct</Button>
                            <Button size="sm" variant="outline" className="rounded-full h-8 text-xs text-red-700 border-red-200 hover:bg-red-50" disabled={!canReview || !!busy} onClick={() => decide(insp.id, f.id, 'REJECT')}>
                              {busy === `${f.id}:REJECT` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ThumbsDown className="w-3 h-3 mr-1" />}Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t text-xs text-emerald-700">All findings decided — generate the report to close this case.</div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!loading && filtered.length === 0 && (
          <Card className="border-dashed shadow-none">
            <CardContent className="p-12 text-center text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-3 text-stone-400" />
              <div className="font-medium text-foreground">Nothing waiting — you&rsquo;re all caught up</div>
              <p className="text-sm mt-1">New scans where the AI is unsure will appear here automatically.</p>
              <Link href="/app/scan"><Button className="rounded-full mt-4">Start a new scan</Button></Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
