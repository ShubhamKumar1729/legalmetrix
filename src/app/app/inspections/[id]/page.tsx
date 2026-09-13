'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronDown,
  ClipboardCheck,
  FileText,
  History,
  Loader2,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { AssistantPanel } from '@/components/assistant/assistant-panel';
import { useSession } from '@/components/session-provider';
import { api, errorMessage } from '@/lib/client/api';
import {
  FINDING_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  formatDate,
  statusVariant,
} from '@/lib/labels';
import type { Finding, Inspection, Report } from '@/types';

type Decision = 'PASS' | 'VIOLATION';

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useSession();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [history, setHistory] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [showTechnical, setShowTechnical] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [corrected, setCorrected] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await api.get<Inspection>(`/api/inspections/${params.id}`);
      setInspection(body);
      if (body.productId) {
        const productBody = await api
          .get<{ history: Inspection[] }>(`/api/products/${body.productId}`)
          .catch(() => null);
        if (productBody) setHistory(productBody.history.filter((item) => item.id !== body.id));
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReview(finding: Finding) {
    if (!inspection) return;
    const decision = decisions[finding.id];
    if (!decision) {
      setError('Choose whether this finding is compliant or a violation.');
      return;
    }
    setSubmitting(finding.id);
    setError('');
    try {
      const body = await api.post<{ inspection: Inspection }>(
        `/api/inspections/${inspection.id}/findings/${finding.id}`,
        {
          decision: decision === 'PASS' ? 'CONFIRM_PASS' : corrected[finding.id] ? 'CORRECT' : 'CONFIRM_VIOLATION',
          correctedValue: corrected[finding.id] || undefined,
          comment: comments[finding.id] || undefined,
        }
      );
      setInspection(body.inspection);
      setDecisions((current) => {
        const next = { ...current };
        delete next[finding.id];
        return next;
      });
    } catch (reviewError) {
      setError(errorMessage(reviewError, 'The review could not be saved.'));
    } finally {
      setSubmitting(null);
    }
  }

  async function generateReport() {
    if (!inspection) return;
    setReportBusy(true);
    setError('');
    try {
      const report = await api.post<Report>(`/api/inspections/${inspection.id}/report`);
      setInspection({ ...inspection, reportId: report.id });
      window.location.href = `/app/reports/${report.id}`;
    } catch (reportError) {
      setError(errorMessage(reportError, 'The report could not be generated.'));
    } finally {
      setReportBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-80 rounded-xl bg-muted" />
      </div>
    );
  }

  if (notFound || !inspection) {
    return (
      <EmptyState
        icon={Package}
        title="Inspection not found"
        description="This inspection may have been removed, or the link is incorrect."
        action={
          <Link href="/app/inspections">
            <Button className="rounded-full">Back to Inspections</Button>
          </Link>
        }
      />
    );
  }

  const findings = inspection.findings || [];
  const counts = {
    passed: findings.filter((f) => f.status === 'PASS').length,
    violations: findings.filter((f) => f.status === 'VIOLATION').length,
    review: findings.filter((f) => f.status === 'REVIEW').length,
  };
  const pending = findings.filter((f) => f.reviewStatus === 'PENDING');
  const canReview = can('review:write');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{inspection.productName}</h1>
            <Badge variant={statusVariant(inspection.status)} className="text-xs">
              {STATUS_LABEL[inspection.status] || inspection.status}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span>{inspection.inspectionNumber}</span>
            <span>{inspection.brand || '—'}</span>
            <span>{inspection.manufacturer}</span>
            <span>{formatDate(inspection.createdAt)}</span>
            <span>By {inspection.inspectorName}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {inspection.reportId ? (
            <Link href={`/app/reports/${inspection.reportId}`}>
              <Button variant="outline" className="rounded-full">
                <FileText className="h-4 w-4" /> View Report
              </Button>
            </Link>
          ) : (
            <Button className="rounded-full" onClick={generateReport} disabled={reportBusy || !inspection.scored}>
              {reportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate Report
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="border-0 bg-slate-900 text-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">Compliance score</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-5xl font-bold">{inspection.scored ? inspection.complianceScore : '—'}</span>
                {inspection.scored && <span className="text-slate-400">/ 100</span>}
              </div>
              {!inspection.scored && (
                <p className="mt-2 text-sm text-slate-300">
                  This inspection was not scored because no rules were evaluated.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-emerald-400">{counts.passed}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Passed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-400">{counts.violations}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Violations</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-400">{counts.review}</div>
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
          <CardDescription>
            {inspection.rulesEvaluated} rule check(s) · {pending.length} awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {findings.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No rules were evaluated"
              description="Publish at least one regulatory rule so inspections can be checked and scored."
              action={
                can('rule:read') ? (
                  <Link href="/app/rules">
                    <Button className="rounded-full">Go to Rules</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            findings.map((finding) => (
              <div key={finding.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{finding.title}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {SEVERITY_LABEL[finding.severity] || finding.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{finding.description}</p>
                  </div>
                  <Badge variant={statusVariant(finding.status)} className="text-[10px]">
                    {FINDING_STATUS_LABEL[finding.status] || finding.status}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>Rule {finding.ruleCode}</span>
                  {finding.legalReference && <span>{finding.legalReference}</span>}
                  {finding.detectedValue && <span>Detected: {finding.detectedValue}</span>}
                  {finding.correctedValue && <span>Corrected: {finding.correctedValue}</span>}
                  <span>Confidence {finding.confidence}%</span>
                  <span>{REVIEW_STATUS_LABEL[finding.reviewStatus] || finding.reviewStatus}</span>
                  {finding.evidence?.length > 0 && <span>{finding.evidence.length} evidence image(s)</span>}
                </div>

                {finding.reviewerName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reviewed by {finding.reviewerName} · {formatDate(finding.reviewedAt)}
                    {finding.reviewerComment ? ` · “${finding.reviewerComment}”` : ''}
                  </p>
                )}

                {finding.reviewStatus === 'PENDING' && canReview && (
                  <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-3">
                    <div className="flex flex-wrap gap-2">
                      {(['PASS', 'VIOLATION'] as Decision[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setDecisions({ ...decisions, [finding.id]: option })}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            decisions[finding.id] === option
                              ? option === 'PASS'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-red-600 text-white'
                              : 'border bg-white hover:bg-accent'
                          }`}
                        >
                          {option === 'PASS' ? 'Compliant on package' : 'Violation confirmed'}
                        </button>
                      ))}
                    </div>

                    <Input
                      value={corrected[finding.id] || ''}
                      onChange={(event) => setCorrected({ ...corrected, [finding.id]: event.target.value })}
                      placeholder="Correct value as printed on the package (optional)"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={comments[finding.id] || ''}
                      onChange={(event) => setComments({ ...comments, [finding.id]: event.target.value })}
                      placeholder="Reviewer comment (optional)"
                      className="h-9 text-sm"
                    />

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() => submitReview(finding)}
                        disabled={submitting === finding.id || !decisions[finding.id]}
                      >
                        {submitting === finding.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Submit Review
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evidence</CardTitle>
          <CardDescription>{inspection.images?.length || 0} image(s) captured for this inspection</CardDescription>
        </CardHeader>
        <CardContent>
          {inspection.images?.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {inspection.images.map((image) => (
                <figure key={image.id} className="overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={`${image.side} of ${inspection.productName}`} className="h-32 w-full object-cover" />
                  <figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px] text-muted-foreground">
                    <span className="capitalize">{image.side.toLowerCase()}</span>
                    <span>{image.source === 'CAMERA' ? 'Camera' : 'Upload'}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No images attached.</p>
          )}
        </CardContent>
      </Card>

      <AssistantPanel inspectionId={inspection.id} />

      {history.length > 0 && (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Other inspections of this product
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/app/inspections/${item.id}`}
                className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent"
              >
                <span>
                  <span className="font-medium">{item.inspectionNumber}</span>
                  <span className="ml-2 text-muted-foreground">{formatDate(item.createdAt)}</span>
                </span>
                <Badge variant={statusVariant(item.status)} className="text-[10px]">
                  {STATUS_LABEL[item.status] || item.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-0 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowTechnical((open) => !open)}
          className="flex w-full items-center justify-between p-5 text-left"
        >
          <span className="text-base font-semibold">Technical details</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showTechnical ? 'rotate-180' : ''}`} />
        </button>
        {showTechnical && (
          <CardContent className="space-y-5 border-t pt-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Inspection ID', inspection.id],
                ['AI run ID', inspection.aiRunId || '—'],
                ['AI provider', inspection.aiProvider || '—'],
                ['Model version', inspection.aiModelVersion || '—'],
                ['Processing time', inspection.processingTimeMs ? `${inspection.processingTimeMs} ms` : '—'],
                ['Rule set', inspection.ruleSetVersion || '—'],
                ['Rules evaluated', String(inspection.rulesEvaluated)],
                ['Average confidence', `${inspection.confidenceSummary?.average ?? 0}%`],
                ['Min confidence', `${inspection.confidenceSummary?.min ?? 0}%`],
                ['Max confidence', `${inspection.confidenceSummary?.max ?? 0}%`],
                ['Low-confidence fields', String(inspection.confidenceSummary?.lowConfidenceCount ?? 0)],
                ['Completed', formatDate(inspection.completedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Extracted fields</h3>
              {inspection.extractedFields?.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-left text-muted-foreground">
                      <tr>
                        <th className="p-2 font-medium">Field</th>
                        <th className="p-2 font-medium">Raw text</th>
                        <th className="p-2 font-medium">Normalized</th>
                        <th className="p-2 font-medium">Confidence</th>
                        <th className="p-2 font-medium">Bounding box</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspection.extractedFields.map((field) => (
                        <tr key={field.id} className="border-t">
                          <td className="p-2 font-medium">{field.fieldName}</td>
                          <td className="p-2">{field.rawText || '—'}</td>
                          <td className="p-2">{field.normalizedValue || '—'}</td>
                          <td className="p-2">{field.confidence}%</td>
                          <td className="p-2 font-mono">
                            {field.boundingBox
                              ? `${field.boundingBox.x},${field.boundingBox.y} ${field.boundingBox.width}×${field.boundingBox.height}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No fields were extracted automatically. Connect a vision model to populate this section.
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Image metadata</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th className="p-2 font-medium">Image</th>
                      <th className="p-2 font-medium">Source</th>
                      <th className="p-2 font-medium">Dimensions</th>
                      <th className="p-2 font-medium">Size</th>
                      <th className="p-2 font-medium">Brightness</th>
                      <th className="p-2 font-medium">Blur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inspection.images || []).map((image) => (
                      <tr key={image.id} className="border-t">
                        <td className="p-2 font-medium">{image.side}</td>
                        <td className="p-2">{image.source}</td>
                        <td className="p-2">
                          {image.width && image.height ? `${image.width}×${image.height}` : '—'}
                        </td>
                        <td className="p-2">{Math.round((image.size || 0) / 1024)} KB</td>
                        <td className="p-2">{image.quality?.brightness ?? '—'}</td>
                        <td className="p-2">{image.quality?.blurScore ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
