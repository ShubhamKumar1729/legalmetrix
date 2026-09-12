'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StepBar } from '@/components/common/step-bar';
import { PageHeader, Notice } from '@/components/common/explainer';
import { StatusBadge, FindingBadge, ConfidenceBadge, SeverityBadge } from '@/components/common/status-badges';
import { friendlyFinding, plainFieldName } from '@/lib/ui/labels';
import {
  CheckCircle2, AlertTriangle, Loader2, Eye, Brain, FileText, MapPin,
  ThumbsUp, ThumbsDown, Edit3, Loader as RefreshIcon, Send,
} from 'lucide-react';
import Link from 'next/link';

// Bounding boxes are stored in a 400×300 coordinate space (see MODEL_INTEGRATION.md);
// real models should return pixel coords and this scaling stays proportional.
const BOX_SPACE = { w: 400, h: 300 };

const FALLBACK_STAGES = [
  'Image quality', 'Reading text (OCR)', 'Finding label zones', 'Spotting declarations',
  'Extracting details', 'Matching languages', 'MRP check', 'Quantity check',
  'Font & readability', 'Applying rules', 'Confidence scoring', 'Final assessment',
];

const DECISION_LABELS: Record<string, { done: string; pending: string }> = {
  ACCEPT: { done: 'You confirmed the AI’s result.', pending: 'Confirm…' },
  REJECT: { done: 'You overruled this finding — recorded in the audit trail.', pending: 'Reject…' },
  CORRECT: { done: 'Your correction was saved — the difference is logged for model training.', pending: 'Save…' },
};

export default function InspectionResultPage() {
  const params = useParams();
  const [inspection, setInspection] = useState<any>(null);
  const [aiMeta, setAiMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [animStage, setAnimStage] = useState<number>(-1); // -1 = not animating
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const [canReview, setCanReview] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      setCanReview(!!u && ['REVIEWER', 'SUPER_ADMIN'].includes(u.role));
    } catch { setCanReview(false); }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/inspections/${params.inspectionId}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data?.error?.message || 'Inspection not found');
        let insp = data.data;

        // Draft/processing inspections trigger (or re-read) the analysis
        if (insp.status === 'DRAFT') {
          // Animate the 12 pipeline stages while the request is in flight
          const animator = setInterval(() => setAnimStage(s => (s >= 11 ? s : s + 1)), 220);
          setAnimStage(0);
          const analyzeRes = await fetch(`/api/inspections/${insp.id}/analyze`, { method: 'POST' });
          const analyzeData = await analyzeRes.json();
          clearInterval(animator);
          setAnimStage(-1);
          if (analyzeData.success) {
            insp = analyzeData.data.inspection;
            setAiMeta(analyzeData.data.aiResult?.modelMetadata);
          } else {
            setError(analyzeData?.error?.message || 'AI analysis failed — open again to retry.');
          }
        } else if (insp.status === 'PROCESSING') {
          // Real model returned async — poll for results (see MODEL_INTEGRATION.md)
          const deadline = Date.now() + 60_000;
          while (insp.status === 'PROCESSING' && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 2000));
            const poll = await fetch(`/api/inspections/${insp.id}/results`).then(r => r.json());
            if (poll?.success && poll.data.ready) {
              const re = await fetch(`/api/inspections/${insp.id}`).then(r => r.json());
              if (re?.success) insp = re.data;
            }
          }
        }

        setInspection(insp);
        if (insp.aiModelMetadata) setAiMeta(insp.aiModelMetadata);
        setActiveFindingId(insp.findings?.[0]?.id ?? null);
      } catch (e: any) {
        setError(e?.message || 'Could not load this inspection.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.inspectionId]);

  const findings: any[] = useMemo(() => inspection?.findings || [], [inspection]);
  const activeFinding = useMemo(() => findings.find(f => f.id === activeFindingId) || findings[0] || null, [findings, activeFindingId]);
  const pendingFindings = findings.filter(f => f.reviewStatus === 'PENDING' && f.status !== 'PASS');
  const activeImage = inspection?.images?.[activeImageIdx];
  const stageNames = aiMeta?.stages?.length ? aiMeta.stages : FALLBACK_STAGES;

  async function decide(findingId: string, decision: 'ACCEPT' | 'REJECT' | 'CORRECT', correctedValue?: string) {
    setBusy(`${findingId}:${decision}`);
    setActionFeedback('');
    try {
      const res = await fetch(`/api/inspections/${inspection.id}/findings/${findingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, correctedValue }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error?.message || 'Could not save your decision');
      setInspection(data.data.inspection);
      setActionFeedback(DECISION_LABELS[decision].done);
    } catch (e: any) {
      setActionFeedback(e?.message || 'Could not save your decision.');
    } finally {
      setBusy(null); setCorrecting(false); setCorrection('');
    }
  }

  async function generateReport() {
    setReportBusy(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: inspection.id }),
      });
      const data = await res.json();
      if (data.success) window.location.href = `/app/reports/${data.data.id}`;
      else setError(data?.error?.message || 'Could not generate the report');
    } finally { setReportBusy(false); }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-24 bg-muted rounded-xl animate-pulse" />
        <div className="h-72 bg-muted rounded-xl animate-pulse" />
        <p className="text-sm text-muted-foreground text-center">Loading the AI’s findings…</p>
      </div>
    );
  }
  if (!inspection) {
    return <Notice tone="bad" icon={<AlertTriangle className="w-4 h-4" />}>{error || 'Inspection not found.'} <Link href="/app/scan" className="underline font-medium">Start a new scan</Link></Notice>;
  }

  const score = inspection.complianceScore;

  return (
    <div className="space-y-6">
      <PageHeader title={inspection.productName} inPlainWords={`Inspection ${inspection.inspectionId} • ${inspection.brand} • checked against rule set ${inspection.ruleSetVersion}`}>
        <StatusBadge status={inspection.status} className="text-xs h-auto py-1" />
      </PageHeader>

      <StepBar
        current={2}
        steps={[
          { n: 1, label: 'Photos taken', hint: 'Done' },
          { n: 2, label: 'Check AI findings', hint: 'You are here' },
          { n: 3, label: 'Queue is clear', hint: 'Decide all “please check” items' },
          { n: 4, label: 'Generate report', hint: 'Bottom of this page' },
        ]}
      />

      {error && <Notice tone="warn">{error}</Notice>}

      {/* Score + verdict */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm bg-stone-900 text-white lg:col-span-1">
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-widest text-stone-400 mb-2">Compliance score</div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">{score}</span><span className="text-stone-400">/ 100</span>
            </div>
            <p className="text-sm text-stone-300 mt-3 leading-relaxed">
              {score >= 80 ? 'The label shows everything the law requires — the AI is confident.'
                : score >= 50 ? 'The label is mostly fine, but something needs a human check or correction.'
                : 'Important declarations are missing or wrong. Treat this as a case, not a pass.'}
            </p>
            <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${score}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div><div className="text-lg font-bold text-emerald-400">{findings.filter((f: any) => f.status === 'PASS').length}</div><div className="text-[10px] text-stone-400 uppercase">Fine</div></div>
              <div><div className="text-lg font-bold text-red-400">{findings.filter((f: any) => f.status === 'VIOLATION').length}</div><div className="text-[10px] text-stone-400 uppercase">Problems</div></div>
              <div><div className="text-lg font-bold text-amber-400">{pendingFindings.length}</div><div className="text-[10px] text-stone-400 uppercase">To check</div></div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/10 space-y-2 text-xs">
              <div className="flex justify-between gap-2"><span className="text-stone-400">AI certainty</span><span className="font-medium">{inspection.confidenceSummary?.average ?? 0}% avg</span></div>
              <div className="flex justify-between gap-2"><span className="text-stone-400">Model</span><span className="font-medium truncate max-w-[55%]" title={aiMeta?.modelVersion || ''}>{aiMeta?.modelName || 'demo model'} • v{aiMeta?.modelVersion || '0.1'}</span></div>
              {typeof aiMeta?.processingTimeMs === 'number' && (
                <div className="flex justify-between gap-2"><span className="text-stone-400">Analysis took</span><span className="font-medium">{(aiMeta.processingTimeMs / 1000).toFixed(1)}s</span></div>
              )}
              <div className="flex justify-between gap-2"><span className="text-stone-400">Low-certainty fields</span><span className="font-medium">{inspection.confidenceSummary?.lowConfidenceCount ?? 0}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4" />How the AI got here <span className="text-xs font-normal text-muted-foreground">— 12 passes over your photos</span></CardTitle></CardHeader>
          <CardContent>
            {animStage >= 0 ? (
              <div className="grid md:grid-cols-2 gap-2.5">
                {stageNames.map((name: string, i: number) => (
                  <div key={name} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm ${i < animStage ? 'bg-emerald-50 border-emerald-200' : i === animStage ? 'bg-stone-100 border-stone-300' : 'opacity-45 border-stone-200'}`}>
                    {i < animStage ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : i === animStage ? <Loader2 className="w-4 h-4 animate-spin text-stone-600" /> : <div className="w-4 h-4 rounded-full border-2 border-stone-300" />}
                    <span className="truncate">{i + 1}. {name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stageNames.map((name: string, i: number) => (
                  <span key={name + i} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />{name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Each pass is recorded with a confidence score. Anything below 75% is never auto-accepted — it waits for you.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Findings + Evidence */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What the AI found on the label</CardTitle>
              <p className="text-xs text-muted-foreground">One row per legally-required item. Click a row to see the photo evidence and decide.</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-muted/30 border-y">
                    <tr>
                      <th className="text-left p-3 font-medium">Label item</th>
                      <th className="text-left p-3 font-medium">What the AI read</th>
                      <th className="text-left p-3 font-medium">Certainty</th>
                      <th className="text-left p-3 font-medium">Verdict</th>
                      <th className="text-left p-3 font-medium">Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map((f: any) => (
                      <tr key={f.id} onClick={() => setActiveFindingId(f.id)}
                        className={`border-b last:border-0 cursor-pointer transition-colors ${activeFinding?.id === f.id ? 'bg-emerald-50/70' : 'hover:bg-muted/20'}`}>
                        <td className="p-3"><div className="font-medium">{f.title}</div><div className="text-xs text-muted-foreground">{plainFieldName((f.declarationType || '').toLowerCase())}</div></td>
                        <td className="p-3 max-w-[170px]"><span className={f.detectedValue ? '' : 'text-muted-foreground italic'}>{f.detectedValue || 'Nothing found'}</span></td>
                        <td className="p-3"><ConfidenceBadge value={f.confidence} /></td>
                        <td className="p-3"><FindingBadge status={f.status} /></td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground" title={f.legalReference}>{f.ruleCode}</td>
                      </tr>
                    ))}
                    {findings.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No findings recorded for this inspection.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Every value the AI read</CardTitle><p className="text-xs text-muted-foreground">Raw OCR text is kept beside the cleaned value so you can always see what the model actually saw.</p></CardHeader>
            <CardContent className="space-y-3">
              {inspection.extractedFields?.map((field: any) => (
                <div key={field.id} className="flex gap-3 p-3 rounded-xl border bg-white items-start">
                  <div className="w-11 h-11 rounded-lg bg-stone-900 text-white flex items-center justify-center flex-shrink-0 text-[11px] font-mono" title={friendlyFinding(field.status).meaning}>{field.confidence}%</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-medium text-sm">{plainFieldName(field.fieldName)}</span>
                      <Badge variant="outline" className="text-[10px]">{field.language} • {field.script}</Badge>
                      <FindingBadge status={field.status} className="text-[10px]" />
                    </div>
                    <div className="text-sm mt-1 break-words">{field.value || <span className="text-muted-foreground italic">Not detected</span>}</div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono break-all">Saw: “{field.rawText}”</div>
                  </div>
                </div>
              ))}
              {(!inspection.extractedFields || inspection.extractedFields.length === 0) && (
                <div className="text-sm text-muted-foreground p-3">No fields were extracted for this inspection.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Evidence viewer + decisions */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center justify-between">Photo evidence {activeImage && <span className="text-[11px] font-normal text-muted-foreground inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{inspection.location?.address || 'location on record'}</span>}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border bg-stone-100 aspect-[4/3]">
                <img src={activeImage?.url || '/api/placeholder/image?text=Evidence'} alt="Evidence photo" className="w-full h-full object-contain" />
                {activeFinding?.evidence?.[0]?.boundingBox && (
                  <div className="absolute border-2 border-emerald-600 bg-emerald-500/10 rounded" style={{
                    left: `${(activeFinding.evidence[0].boundingBox.x / BOX_SPACE.w) * 100}%`,
                    top: `${(activeFinding.evidence[0].boundingBox.y / BOX_SPACE.h) * 100}%`,
                    width: `${(activeFinding.evidence[0].boundingBox.width / BOX_SPACE.w) * 100}%`,
                    height: `${(activeFinding.evidence[0].boundingBox.height / BOX_SPACE.h) * 100}%`,
                  }}>
                    <div className="absolute -top-5 left-0 bg-emerald-700 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">{activeFinding.title}</div>
                  </div>
                )}
                {!activeFinding?.evidence?.length && activeFinding && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[11px] px-2 py-1.5">The AI found nothing here to highlight — that absence is the finding.</div>
                )}
              </div>

              {inspection.images?.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {inspection.images.map((img: any, i: number) => (
                    <button key={img.id} onClick={() => setActiveImageIdx(i)} className={`rounded-lg border overflow-hidden aspect-square transition-all ${i === activeImageIdx ? 'ring-2 ring-emerald-600 border-transparent' : 'hover:ring-1 hover:ring-stone-300'}`}>
                      <img src={img.url} alt={img.side} className="w-full h-full object-cover" />
                      <span className="block text-[10px] py-0.5 bg-stone-50">{img.side}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeFinding && (
                <div className="rounded-xl border bg-white p-4 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div><div className="font-semibold text-sm">{activeFinding.title}</div><div className="text-xs text-muted-foreground mt-0.5">{activeFinding.description}</div></div>
                    <FindingBadge status={activeFinding.status} />
                  </div>
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Law requires</span><span className="font-medium text-right max-w-[60%]">{activeFinding.expectedValue || 'Must be present on the label'}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Found on label</span><span className="font-medium text-right max-w-[60%] break-words">{activeFinding.detectedValue || 'Nothing'}</span></div>
                    {activeFinding.correctedValue && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Human correction</span><span className="font-medium text-right max-w-[60%] break-words text-emerald-700">{activeFinding.correctedValue}</span></div>}
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Seriousness</span><SeverityBadge severity={activeFinding.severity} /></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Rule</span><span className="font-mono">{activeFinding.ruleCode}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Status</span><span className="font-medium">{activeFinding.reviewStatus === 'PENDING' ? 'Waiting for a decision' : `Decided (${activeFinding.reviewStatus})`}</span></div>
                  </div>

                  {activeFinding.reviewStatus === 'PENDING' && (
                    <>
                      {canReview ? (
                        correcting ? (
                          <div className="space-y-2 pt-2 border-t">
                            <Input value={correction} onChange={e => setCorrection(e.target.value)} placeholder={`Correct value for ${plainFieldName(activeFinding.declarationType?.toLowerCase() || '')}`} />
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 rounded-full h-8 text-xs" disabled={!correction.trim() || !!busy} onClick={() => decide(activeFinding.id, 'CORRECT', correction.trim())}>
                                {busy ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving…</> : <>Save correction <Edit3 className="w-3 h-3 ml-1" /></>}
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" onClick={() => setCorrecting(false)}>Cancel</Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Saved as “corrected”. Your value becomes official; the AI’s value is kept for model improvement.</p>
                          </div>
                        ) : (
                          <div className="flex gap-2 pt-2 border-t">
                            <Button size="sm" className="flex-1 rounded-full h-8 text-xs" disabled={!!busy} onClick={() => decide(activeFinding.id, 'ACCEPT')}>
                              <ThumbsUp className="w-3 h-3 mr-1" />{busy === `${activeFinding.id}:ACCEPT` ? 'Saving…' : 'Agree with AI'}
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 rounded-full h-8 text-xs" disabled={!!busy} onClick={() => setCorrecting(true)}>
                              <Edit3 className="w-3 h-3 mr-1" />Correct
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 rounded-full h-8 text-xs text-red-700 border-red-200 hover:bg-red-50" disabled={!!busy} onClick={() => decide(activeFinding.id, 'REJECT')}>
                              <ThumbsDown className="w-3 h-3 mr-1" />Reject
                            </Button>
                          </div>
                        )
                      ) : (
                        <div className="text-[11px] text-muted-foreground bg-stone-50 border rounded-lg p-2 pt-2">
                          Decisions here are made by <strong>Reviewers</strong>. Your role can inspect the evidence but not decide — that separation is intentional.
                        </div>
                      )}
                      {actionFeedback && <div className="text-xs text-emerald-700 pt-1">{actionFeedback}</div>}
                    </>
                  )}
                </div>
              )}

              <Notice tone="neutral">
                <strong>Why the box matters:</strong> Finding → photo region → AI reading → rule → your decision → report. Every link is stored, so any order can be proven in court later.
              </Notice>
            </CardContent>
          </Card>

          {/* Final step */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Ready to close this inspection?</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {pendingFindings.length === 0
                      ? 'All items decided. Generate the official report.'
                      : `${pendingFindings.length} item${pendingFindings.length === 1 ? '' : 's'} still ${pendingFindings.length === 1 ? 'needs' : 'need'} a human decision.`}
                  </div>
                </div>
                {pendingFindings.length === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 rounded-full" disabled={reportBusy} onClick={generateReport}>
                  {reportBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : <><FileText className="w-4 h-4 mr-2" />Generate report</>}
                </Button>
                <Link href="/app/review" className="flex-1"><Button variant="outline" className="w-full rounded-full"><RefreshIcon className="w-4 h-4 mr-2" />Review queue</Button></Link>
              </div>
              {pendingFindings.length > 0 && <p className="text-[11px] text-muted-foreground">You can still generate a draft report, but reviewers’ notes will show it as pending decision.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
