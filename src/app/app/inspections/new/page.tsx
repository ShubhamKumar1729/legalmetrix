'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  AlertTriangle,
  Package,
  ImageIcon,
  Brain,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageManager, type DraftImage } from '@/components/inspection/image-manager';
import { api, errorMessage } from '@/lib/client/api';
import { FINDING_STATUS_LABEL, STATUS_LABEL, statusVariant } from '@/lib/labels';
import type { Inspection, Report } from '@/types';

const STEPS = [
  { n: 1, label: 'Product', short: 'Product info' },
  { n: 2, label: 'Images', short: 'Capture images' },
  { n: 3, label: 'Analysis', short: 'Analyzing' },
  { n: 4, label: 'Result', short: 'Compliance result' },
  { n: 5, label: 'Report', short: 'Generate report' },
];

const CATEGORIES = ['FOOD', 'COSMETICS', 'GROCERY', 'ELECTRONICS', 'TEXTILES', 'OTHER'];

interface ProductForm {
  productName: string;
  brand: string;
  category: string;
  manufacturer: string;
  barcode: string;
  batchNumber: string;
}

const EMPTY_FORM: ProductForm = {
  productName: '',
  brand: '',
  category: 'FOOD',
  manufacturer: '',
  barcode: '',
  batchNumber: '',
};

export default function NewInspectionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stageMessage, setStageMessage] = useState('');
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  const pendingReview = (inspection?.findings || []).filter((f) => f.reviewStatus === 'PENDING');

  function validateStep1(): boolean {
    if (!form.productName.trim()) {
      setFormError('Product name is required.');
      return false;
    }
    if (!form.manufacturer.trim()) {
      setFormError('Manufacturer, packer or importer is required.');
      return false;
    }
    setFormError('');
    return true;
  }

  async function runAnalysis() {
    if (images.length === 0) {
      setError('Add at least one package image before analyzing.');
      return;
    }
    setBusy(true);
    setError('');
    setStep(3);

    try {
      setStageMessage('Creating the inspection record…');
      const created = await api.post<Inspection>('/api/inspections', {
        ...form,
        images: images.map((image) => ({
          id: image.id,
          side: image.side,
          originalName: image.originalName,
          size: image.size,
          width: image.width,
          height: image.height,
          source: image.source,
          quality: image.quality,
        })),
        source: images.some((image) => image.source === 'CAMERA') ? 'FIELD' : 'UPLOAD',
      });

      setStageMessage('Analyzing the package against the configured rules…');
      const analyzed = await api.post<{ inspection: Inspection }>(`/api/inspections/${created.id}/analyze`);
      setInspection(analyzed.inspection);
      setStep(4);
    } catch (analysisError) {
      setError(errorMessage(analysisError, 'The inspection could not be analyzed.'));
      setStep(2);
    } finally {
      setBusy(false);
      setStageMessage('');
    }
  }

  async function generateReport() {
    if (!inspection) return;
    setBusy(true);
    setError('');
    try {
      const created = await api.post<Report>(`/api/inspections/${inspection.id}/report`);
      setReport(created);
      setStep(5);
    } catch (reportError) {
      setError(errorMessage(reportError, 'The report could not be generated.'));
    } finally {
      setBusy(false);
    }
  }

  const counts = {
    passed: (inspection?.findings || []).filter((f) => f.status === 'PASS').length,
    violations: (inspection?.findings || []).filter((f) => f.status === 'VIOLATION').length,
    review: (inspection?.findings || []).filter((f) => f.status === 'REVIEW').length,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Inspection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record the product, capture the package, then analyze it against the configured rules.
        </p>
      </div>

      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {STEPS.map((entry, index) => (
          <li key={entry.n} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  step > entry.n
                    ? 'bg-emerald-500 text-white'
                    : step === entry.n
                      ? 'bg-slate-900 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > entry.n ? <CheckCircle2 className="h-4 w-4" /> : entry.n}
              </span>
              <span className={`text-sm ${step === entry.n ? 'font-semibold' : 'text-muted-foreground'}`}>
                {entry.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span className={`h-px w-6 sm:w-10 ${step > entry.n ? 'bg-emerald-500' : 'bg-muted'}`} />
            )}
          </li>
        ))}
      </ol>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1 — Product information */}
      {step === 1 && (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" /> Product information
            </CardTitle>
            <CardDescription>Basic details for traceability. Only the starred fields are required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="productName">Product name *</Label>
                <Input
                  id="productName"
                  value={form.productName}
                  onChange={(event) => setForm({ ...form, productName: event.target.value })}
                  placeholder="As printed on the package"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={(event) => setForm({ ...form, barcode: event.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="manufacturer">Manufacturer / Packer / Importer *</Label>
                <Input
                  id="manufacturer"
                  value={form.manufacturer}
                  onChange={(event) => setForm({ ...form, manufacturer: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchNumber">Batch / Lot</Label>
                <Input
                  id="batchNumber"
                  value={form.batchNumber}
                  onChange={(event) => setForm({ ...form, batchNumber: event.target.value })}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end pt-2">
              <Button className="rounded-full px-6" onClick={() => validateStep1() && setStep(2)}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Images */}
      {step === 2 && (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4" /> Capture package images
            </CardTitle>
            <CardDescription>
              Use the device camera or upload photos. Front and back are usually enough; add more if the
              declarations are spread across the package.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ImageManager images={images} onChange={setImages} />

            <div className="flex justify-between pt-2">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button className="rounded-full px-6" onClick={runAnalysis} disabled={images.length === 0 || busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Analyze Product
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Analysis in progress */}
      {step === 3 && (
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <div>
              <p className="font-medium">{stageMessage || 'Analyzing…'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {images.length} image{images.length === 1 ? '' : 's'} submitted for analysis.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Result */}
      {step === 4 && inspection && (
        <div className="space-y-6">
          <Card className="border-0 bg-slate-900 text-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-400">Compliance score</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-5xl font-bold">
                      {inspection.scored ? inspection.complianceScore : '—'}
                    </span>
                    {inspection.scored && <span className="text-slate-400">/ 100</span>}
                  </div>
                  <div className="mt-4">
                    <Badge variant={statusVariant(inspection.status)} className="text-xs">
                      {STATUS_LABEL[inspection.status] || inspection.status}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">{counts.passed}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Passed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">{counts.violations}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Violations</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-400">{counts.review}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Needs review</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {inspection.analysisNotes?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">About this analysis</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {inspection.analysisNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <Card className="border-0 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Findings</CardTitle>
              <CardDescription>{inspection.findings.length} rule check(s) evaluated</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {inspection.findings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No rules were evaluated. Publish at least one rule to score this inspection.
                </p>
              ) : (
                inspection.findings.map((finding) => (
                  <div key={finding.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{finding.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{finding.description}</div>
                      </div>
                      <Badge variant={statusVariant(finding.status)} className="text-[10px]">
                        {FINDING_STATUS_LABEL[finding.status] || finding.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>Rule {finding.ruleCode}</span>
                      {finding.detectedValue && <span>Detected: {finding.detectedValue}</span>}
                      <span>Confidence {finding.confidence}%</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-between gap-3">
            <Link href={`/app/inspections/${inspection.id}`}>
              <Button variant="outline" className="rounded-full">
                View full result
              </Button>
            </Link>
            {pendingReview.length > 0 ? (
              <Button
                className="rounded-full px-6"
                onClick={() => router.push(`/app/inspections/${inspection.id}?review=1`)}
              >
                <ClipboardCheck className="h-4 w-4" /> Review Findings
              </Button>
            ) : (
              <Button className="rounded-full px-6" onClick={generateReport} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate Report
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 5 — Report */}
      {step === 5 && report && (
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Report generated</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.reportNumber} · {report.productName}
              </p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{report.summary}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link href={`/app/reports/${report.id}`}>
                <Button className="rounded-full">
                  <FileText className="h-4 w-4" /> View Report
                </Button>
              </Link>
              <Link href="/app/dashboard">
                <Button variant="outline" className="rounded-full">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
