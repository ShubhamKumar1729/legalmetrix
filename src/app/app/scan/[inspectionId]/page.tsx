"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, AlertTriangle, Clock, Eye, Brain, Scale,
  FileText, MapPin, Calendar, User, Package, Languages,
  Zap, Shield, ArrowRight, Edit3, ThumbsUp, ThumbsDown
} from 'lucide-react';
import Link from 'next/link';

export default function InspectionResultPage() {
  const params = useParams();
  const [inspection, setInspection] = useState<any>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFinding, setActiveFinding] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/inspections/${params.inspectionId}`);
        const data = await res.json();
        if (data.success) {
          setInspection(data.data);
          setActiveFinding(data.data.findings?.[0]);
          // If draft, trigger analysis
          if (data.data.status === 'DRAFT' || data.data.status === 'PROCESSING') {
            const analyzeRes = await fetch(`/api/inspections/${data.data.id}/analyze`, { method: 'POST' });
            const analyzeData = await analyzeRes.json();
            if (analyzeData.success) {
              setInspection(analyzeData.data.inspection);
              setAiResult(analyzeData.data.aiResult);
              setActiveFinding(analyzeData.data.inspection.findings?.[0]);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.inspectionId]);

  if (loading) return <div className="animate-pulse space-y-6"><div className="h-32 bg-muted rounded-xl" /><div className="h-96 bg-muted rounded-xl" /></div>;
  if (!inspection) return <div>Inspection not found</div>;

  const score = inspection.complianceScore;
  const status = inspection.status;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{inspection.productName}</h1>
            <Badge variant={status === 'COMPLIANT' ? 'compliant' : status === 'NON_COMPLIANT' ? 'violation' : 'review'}>{status}</Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><Package className="w-3 h-3" />{inspection.inspectionId}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(inspection.createdAt).toLocaleString()}</span>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{inspection.inspectorName}</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{inspection.location?.address || 'Field'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/app/review"><Button variant="outline" className="rounded-full">Review Queue</Button></Link>
          <Link href="/app/reports"><Button className="rounded-full">Generate Report <FileText className="w-4 h-4 ml-2" /></Button></Link>
        </div>
      </div>

      {/* Score + AI Pipeline */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm bg-slate-900 text-white lg:col-span-1">
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Compliance Score</div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">{score}</span><span className="text-slate-400">/ 100</span>
            </div>
            <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${score}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div><div className="text-lg font-bold text-emerald-400">{inspection.findings?.filter((f: any) => f.status === 'PASS').length || 0}</div><div className="text-[10px] text-slate-400 uppercase">Passed</div></div>
              <div><div className="text-lg font-bold text-red-400">{inspection.findings?.filter((f: any) => f.status === 'VIOLATION').length || 0}</div><div className="text-[10px] text-slate-400 uppercase">Violations</div></div>
              <div><div className="text-lg font-bold text-amber-400">{inspection.findings?.filter((f: any) => f.status === 'REVIEW').length || 0}</div><div className="text-[10px] text-slate-400 uppercase">Review</div></div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/10 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">AI Confidence</span><span className="font-medium">{inspection.confidenceSummary?.average}% avg</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Rule Set</span><span className="font-medium">{inspection.ruleSetVersion}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Model</span><span className="font-medium">mock-vision-v0.1.0</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Low Confidence</span><span className="font-medium">{inspection.confidenceSummary?.lowConfidenceCount} fields</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4" />AI Processing Pipeline</CardTitle></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { id: 'image-quality', name: 'Image Quality Analysis', status: 'COMPLETED' },
                { id: 'ocr', name: 'OCR Text Extraction', status: 'COMPLETED' },
                { id: 'text-region', name: 'Text Region Detection', status: 'COMPLETED' },
                { id: 'declaration-detection', name: 'Declaration Detection', status: 'COMPLETED' },
                { id: 'entity-extraction', name: 'Entity Extraction', status: 'COMPLETED' },
                { id: 'multilingual', name: 'Multilingual Matching', status: 'COMPLETED' },
                { id: 'mrp-analysis', name: 'MRP Analysis', status: 'COMPLETED' },
                { id: 'quantity-analysis', name: 'Net Quantity Analysis', status: 'COMPLETED' },
                { id: 'font-analysis', name: 'Font & Readability', status: 'WARNING' },
                { id: 'rule-validation', name: 'Rule Validation', status: 'COMPLETED' },
                { id: 'confidence-scoring', name: 'Confidence Scoring', status: 'COMPLETED' },
                { id: 'final-decision', name: 'Final Decision', status: 'COMPLETED' },
              ].map((stage) => (
                <div key={stage.id} className={`flex items-center gap-3 p-3 rounded-xl border ${stage.status === 'WARNING' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${stage.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : stage.status === 'WARNING' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                    {stage.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{stage.name}</div>
                    <div className="text-xs text-muted-foreground">{stage.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Findings */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Mandatory Declarations • Rule Validation</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-muted/30 border-y"><tr><th className="text-left p-3 font-medium">Declaration</th><th className="text-left p-3 font-medium">Detected</th><th className="text-left p-3 font-medium">Confidence</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Evidence</th><th className="text-left p-3 font-medium">Rule</th></tr></thead>
                  <tbody>
                    {inspection.findings?.map((f: any) => (
                      <tr key={f.id} className={`border-b last:border-0 hover:bg-muted/20 cursor-pointer ${activeFinding?.id === f.id ? 'bg-blue-50/50' : ''}`} onClick={() => setActiveFinding(f)}>
                        <td className="p-3"><div className="font-medium">{f.title}</div><div className="text-xs text-muted-foreground">{f.declarationType}</div></td>
                        <td className="p-3 max-w-[160px] truncate">{f.detectedValue || <span className="text-muted-foreground">Missing</span>}</td>
                        <td className="p-3"><Badge variant={f.confidence >= 90 ? 'compliant' : f.confidence >= 75 ? 'review' : 'violation'} className="text-[10px]">{f.confidence}%</Badge></td>
                        <td className="p-3"><Badge variant={f.status === 'PASS' ? 'compliant' : f.status === 'VIOLATION' ? 'violation' : 'review'} className="text-[10px]">{f.status}</Badge></td>
                        <td className="p-3"><Button variant="ghost" size="sm" className="h-7 text-xs"><Eye className="w-3 h-3 mr-1" />View</Button></td>
                        <td className="p-3 font-mono text-xs">{f.ruleCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Extracted Fields • Multilingual • Bounding Boxes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {inspection.extractedFields?.map((field: any) => (
                <div key={field.id} className="flex gap-3 p-3 rounded-xl border bg-white">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-mono">{field.confidence}%</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 items-center"><span className="font-medium text-sm">{field.fieldName}</span><Badge variant="outline" className="text-[10px]">{field.language} • {field.script}</Badge><Badge variant={field.status === 'PASS' ? 'compliant' : field.status === 'VIOLATION' ? 'violation' : 'review'} className="text-[10px]">{field.status}</Badge></div>
                    <div className="text-sm mt-1">{field.value || <span className="text-muted-foreground italic">Not detected</span>}</div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono">Raw: "{field.rawText}" • Box: [{field.boundingBox.x},{field.boundingBox.y},{field.boundingBox.width}x{field.boundingBox.height}] • Source: {field.sourceImageId}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Edit3 className="w-3 h-3" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Evidence Viewer */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Evidence Viewer • Geo-Tagged</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border bg-slate-50 aspect-[4/3]">
                <img src={inspection.images?.[0]?.url || '/api/placeholder/image?text=Evidence'} alt="Evidence" className="w-full h-full object-cover" />
                {/* Bounding box overlay */}
                {activeFinding?.evidence?.[0]?.boundingBox && (
                  <div className="absolute border-2 border-blue-500 bg-blue-500/10 rounded" style={{
                    left: `${(activeFinding.evidence[0].boundingBox.x / 400) * 100}%`,
                    top: `${(activeFinding.evidence[0].boundingBox.y / 300) * 100}%`,
                    width: `${(activeFinding.evidence[0].boundingBox.width / 400) * 100}%`,
                    height: `${(activeFinding.evidence[0].boundingBox.height / 300) * 100}%`,
                  }}>
                    <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded">{activeFinding.declarationType}</div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px]">
                  <span className="bg-black/70 text-white px-2 py-1 rounded-full">{inspection.images?.[0]?.side} • {inspection.images?.[0]?.quality?.readability ? `${Math.round(inspection.images[0].quality.readability * 100)}% readability` : ''}</span>
                  <span className="bg-black/70 text-white px-2 py-1 rounded-full flex items-center gap-1"><MapPin className="w-3 h-3" />{inspection.location?.latitude?.toFixed(4)}, {inspection.location?.longitude?.toFixed(4)}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {inspection.images?.map((img: any) => (
                  <button key={img.id} className="rounded-lg border overflow-hidden aspect-square hover:ring-2 hover:ring-primary"><img src={img.url} alt={img.side} className="w-full h-full object-cover" /></button>
                ))}
              </div>

              {activeFinding && (
                <div className="rounded-xl border bg-white p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div><div className="font-medium text-sm">{activeFinding.title}</div><div className="text-xs text-muted-foreground">{activeFinding.description}</div></div>
                    <Badge variant={activeFinding.status === 'PASS' ? 'compliant' : activeFinding.status === 'VIOLATION' ? 'violation' : 'review'}>{activeFinding.status}</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Requirement</span><span className="font-medium">{activeFinding.expectedValue || 'Mandatory'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Detected</span><span className="font-medium">{activeFinding.detectedValue || 'Missing'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Rule</span><span className="font-mono">{activeFinding.ruleCode}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Legal Ref</span><span>{activeFinding.legalReference}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><span className="font-bold">{activeFinding.confidence}% • {activeFinding.reviewStatus}</span></div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 rounded-full h-8 text-xs"><ThumbsUp className="w-3 h-3 mr-1" />Accept AI</Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-full h-8 text-xs"><Edit3 className="w-3 h-3 mr-1" />Correct</Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-full h-8 text-xs"><ThumbsDown className="w-3 h-3 mr-1" />Reject</Button>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs">
                <div className="font-medium text-blue-900 flex items-center gap-1"><Shield className="w-3 h-3" />Evidence Traceability</div>
                <div className="text-blue-700 mt-1 leading-relaxed">Finding → Evidence (Image + BoundingBox) → AI Output (Model v0.1.0) → Rule (LM-PC-2011 v1.2) → Reviewer Decision → Final Report • Immutable audit trail</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
