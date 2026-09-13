'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Scale, X } from 'lucide-react';
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

const OPERATORS = ['exists', 'not_exists', 'equals', 'not_equals', 'contains', 'regex', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in'];
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'WARNING'];
const CATEGORIES = ['MANUFACTURER_INFO', 'PRODUCT_IDENTITY', 'NET_QUANTITY', 'MRP', 'CONSUMER_CARE', 'DATE_MARKING', 'LABELLING', 'GENERAL'];

interface RuleForm {
  ruleCode: string;
  title: string;
  description: string;
  legalReference: string;
  category: string;
  applicableProductCategories: string;
  requirementType: 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED';
  severity: string;
  field: string;
  operator: string;
  value: string;
  reviewRequired: boolean;
  evidenceRequired: boolean;
  enabled: boolean;
  status: string;
}

const EMPTY_RULE: RuleForm = {
  ruleCode: '',
  title: '',
  description: '',
  legalReference: '',
  category: 'GENERAL',
  applicableProductCategories: 'ALL',
  requirementType: 'MANDATORY',
  severity: 'HIGH',
  field: '',
  operator: 'exists',
  value: '',
  reviewRequired: false,
  evidenceRequired: true,
  enabled: true,
  status: 'DRAFT',
};

function toPayload(form: RuleForm) {
  const usesList = form.operator === 'in' || form.operator === 'not_in';
  return {
    ruleCode: form.ruleCode.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    legalReference: form.legalReference.trim(),
    category: form.category,
    applicableProductCategories: form.applicableProductCategories
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    requirementType: form.requirementType,
    severity: form.severity,
    validationLogic: {
      field: form.field.trim(),
      operator: form.operator,
      ...(usesList
        ? { value: form.value.split(',').map((entry) => entry.trim()).filter(Boolean) }
        : form.value
          ? { value: form.value }
          : {}),
    },
    reviewRequired: form.reviewRequired,
    evidenceRequired: form.evidenceRequired,
    enabled: form.enabled,
    status: form.status,
  };
}

export default function RulesPage() {
  const { can } = useSession();
  const [rules, setRules] = useState<RegulatoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RuleForm>(EMPTY_RULE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/rules', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setRules(body.data.rules || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function createRule() {
    setSaving(true);
    setError('');
    try {
      await api.post('/api/rules', toPayload(form));
      setForm(EMPTY_RULE);
      setShowForm(false);
      load();
    } catch (createError) {
      setError(errorMessage(createError, 'The rule could not be created.'));
    } finally {
      setSaving(false);
    }
  }

  const published = rules.filter((rule) => rule.enabled && rule.status === 'PUBLISHED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {published} published rule{published === 1 ? '' : 's'} · only published rules are applied during analysis.
          </p>
        </div>
        {can('rule:write') && (
          <Button className="rounded-full" onClick={() => setShowForm((open) => !open)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Close' : 'New Rule'}
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">New rule</CardTitle>
            <CardDescription>
              Define what must appear on the package and how it is checked. Draft rules are not applied until published.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ruleCode">Rule code *</Label>
                <Input
                  id="ruleCode"
                  value={form.ruleCode}
                  onChange={(event) => setForm({ ...form, ruleCode: event.target.value })}
                  placeholder="LM-PC-2011-6(1)(e)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">What the package must show</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalReference">Legal reference</Label>
                <Input
                  id="legalReference"
                  value={form.legalReference}
                  onChange={(event) => setForm({ ...form, legalReference: event.target.value })}
                />
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
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicable">Applies to categories</Label>
                <Input
                  id="applicable"
                  value={form.applicableProductCategories}
                  onChange={(event) => setForm({ ...form, applicableProductCategories: event.target.value })}
                  placeholder="ALL or FOOD,COSMETICS"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <select
                  id="severity"
                  value={form.severity}
                  onChange={(event) => setForm({ ...form, severity: event.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {SEVERITIES.map((severity) => (
                    <option key={severity}>{severity}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="field">Field to check *</Label>
                <Input
                  id="field"
                  value={form.field}
                  onChange={(event) => setForm({ ...form, field: event.target.value })}
                  placeholder="mrp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operator">Check</Label>
                <select
                  id="operator"
                  value={form.operator}
                  onChange={(event) => setForm({ ...form, operator: event.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {OPERATORS.map((operator) => (
                    <option key={operator}>{operator}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Expected value</Label>
                <Input
                  id="value"
                  value={form.value}
                  onChange={(event) => setForm({ ...form, value: event.target.value })}
                  placeholder="Only needed for comparison checks"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {['DRAFT', 'VALIDATION', 'READY_FOR_APPROVAL', 'APPROVED', 'PUBLISHED'].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                {[
                  ['reviewRequired', 'Send uncertain results to review'],
                  ['evidenceRequired', 'Evidence required'],
                  ['enabled', 'Enabled'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form[key as keyof RuleForm] as boolean}
                      onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button className="rounded-full" onClick={createRule} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No regulatory rules configured yet"
          description={
            can('rule:write')
              ? 'Create the mandatory declaration checks that inspections should be evaluated against.'
              : 'An administrator needs to configure and publish the rule set before inspections can be scored.'
          }
          action={
            can('rule:write') ? (
              <Button className="rounded-full" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Create the first rule
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left font-medium">Rule</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Version</th>
                    <th className="hidden p-3 text-left font-medium sm:table-cell">Category</th>
                    <th className="p-3 text-left font-medium">Severity</th>
                    <th className="hidden p-3 text-right font-medium md:table-cell">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <Link href={`/app/rules/${rule.id}`} className="font-medium hover:underline">
                          {rule.ruleCode}
                        </Link>
                        <div className="text-xs text-muted-foreground">{rule.title}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant={rule.status === 'PUBLISHED' ? 'compliant' : 'secondary'} className="text-[10px]">
                          {RULE_STATUS_LABEL[rule.status] || rule.status}
                        </Badge>
                        {!rule.enabled && <span className="ml-1 text-[10px] text-muted-foreground">disabled</span>}
                      </td>
                      <td className="p-3">v{rule.version}</td>
                      <td className="hidden p-3 text-muted-foreground sm:table-cell">{rule.category}</td>
                      <td className="p-3">{SEVERITY_LABEL[rule.severity] || rule.severity}</td>
                      <td className="hidden p-3 text-right text-muted-foreground md:table-cell">
                        {formatDate(rule.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
