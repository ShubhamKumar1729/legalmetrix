'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Copy, Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/components/session-provider';
import { api, errorMessage } from '@/lib/client/api';
import { RULE_STATUS_LABEL, SEVERITY_LABEL, formatDate } from '@/lib/labels';
import type { RegulatoryRule } from '@/types';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'WARNING'];
const STATUSES = ['DRAFT', 'VALIDATION', 'READY_FOR_APPROVAL', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];

export default function RuleDetailPage() {
  const params = useParams<{ ruleId: string }>();
  const { can } = useSession();

  const [rule, setRule] = useState<RegulatoryRule | null>(null);
  const [versions, setVersions] = useState<RegulatoryRule[]>([]);
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch(`/api/rules/${params.ruleId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (!body.success) return;
        setRule(body.data.rule);
        setVersions(body.data.versions || []);
        setDraft(body.data.rule);
      })
      .finally(() => setLoading(false));
  }, [params.ruleId]);

  useEffect(load, [load]);

  async function save(patch: Record<string, unknown>, successMessage: string) {
    if (!rule) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.patch<RegulatoryRule>(`/api/rules/${rule.id}`, patch);
      setRule(updated);
      setDraft(updated);
      setMessage(successMessage);
      load();
    } catch (saveError) {
      setError(errorMessage(saveError, 'The rule could not be updated.'));
    } finally {
      setSaving(false);
    }
  }

  async function createVersion() {
    if (!rule) return;
    setSaving(true);
    setError('');
    try {
      const created = await api.post<RegulatoryRule>(`/api/rules/${rule.id}/versions`);
      setMessage(`Draft v${created.version} created.`);
      window.location.href = `/app/rules/${created.id}`;
    } catch (versionError) {
      setError(errorMessage(versionError, 'A new version could not be created.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  if (!rule || !draft) {
    return (
      <EmptyState
        icon={ArrowLeft}
        title="Rule not found"
        description="This rule could not be located."
        action={
          <Link href="/app/rules">
            <Button className="rounded-full">Back to Rules</Button>
          </Link>
        }
      />
    );
  }

  const editable = can('rule:write');
  const canPublish = can('rule:publish');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/app/rules" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Rules
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{rule.ruleCode}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rule.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={rule.status === 'PUBLISHED' ? 'compliant' : 'secondary'}>
            {RULE_STATUS_LABEL[rule.status] || rule.status}
          </Badge>
          <Badge variant="outline">v{rule.version}</Badge>
          <Badge variant="outline">{SEVERITY_LABEL[rule.severity] || rule.severity}</Badge>
        </div>
      </div>

      {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Rule definition</CardTitle>
          <CardDescription>
            {editable ? 'Changes take effect for new analyses once saved.' : 'Only administrators can modify rules.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule-title">Title</Label>
              <Input
                id="rule-title"
                value={draft.title}
                disabled={!editable}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-legal">Legal reference</Label>
              <Input
                id="rule-legal"
                value={draft.legalReference}
                disabled={!editable}
                onChange={(event) => setDraft({ ...draft, legalReference: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rule-description">What the package must show</Label>
              <Input
                id="rule-description"
                value={draft.description}
                disabled={!editable}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-severity">Severity</Label>
              <select
                id="rule-severity"
                value={draft.severity}
                disabled={!editable}
                onChange={(event) => setDraft({ ...draft, severity: event.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60"
              >
                {SEVERITIES.map((severity) => (
                  <option key={severity}>{severity}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-status">Status</Label>
              <select
                id="rule-status"
                value={draft.status}
                disabled={!editable || (draft.status !== 'PUBLISHED' && !canPublish)}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60"
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Validation logic</div>
            <pre className="mt-1 overflow-x-auto font-mono text-xs">{JSON.stringify(rule.validationLogic, null, 2)}</pre>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>Requirement: {rule.requirementType}</span>
            <span>Applies to: {rule.applicableProductCategories.join(', ')}</span>
            <span>Effective from: {rule.effectiveFrom || '—'}</span>
            <span>Updated: {formatDate(rule.updatedAt)}</span>
          </div>

          {editable && (
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-full" onClick={createVersion} disabled={saving}>
                <Copy className="h-4 w-4" /> Create Version
              </Button>
              <Button
                className="rounded-full"
                onClick={() =>
                  save(
                    {
                      title: draft.title,
                      description: draft.description,
                      legalReference: draft.legalReference,
                      severity: draft.severity,
                      status: draft.status,
                    },
                    'Rule updated.'
                  )
                }
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
              {rule.status !== 'PUBLISHED' && canPublish && (
                <Button
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => save({ status: 'PUBLISHED', enabled: true }, 'Rule published — it will now be applied.')}
                  disabled={saving}
                >
                  Publish
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {versions.length > 1 && (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Versions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {versions.map((version) => (
              <Link
                key={version.id}
                href={`/app/rules/${version.id}`}
                className={`flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent ${
                  version.id === rule.id ? 'border-slate-900' : ''
                }`}
              >
                <span>
                  <span className="font-medium">v{version.version}</span>
                  <span className="ml-2 text-muted-foreground">{formatDate(version.updatedAt)}</span>
                </span>
                <Badge variant={version.status === 'PUBLISHED' ? 'compliant' : 'secondary'} className="text-[10px]">
                  {RULE_STATUS_LABEL[version.status] || version.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
