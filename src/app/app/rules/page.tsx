'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Explainer } from '@/components/common/explainer';
import { SeverityBadge } from '@/components/common/status-badges';
import { describeLogic } from '@/lib/ui/labels';
import { Scale, Plus, Eye, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

const STATUS_PLAIN: Record<string, { label: string; variant: any }> = {
  PUBLISHED: { label: 'Active', variant: 'compliant' },
  DRAFT: { label: 'Draft', variant: 'secondary' },
  VALIDATION: { label: 'Being tested', variant: 'review' },
  READY_FOR_APPROVAL: { label: 'Waiting approval', variant: 'review' },
  APPROVED: { label: 'Approved', variant: 'compliant' },
  ARCHIVED: { label: 'Retired', variant: 'secondary' },
};

export default function RulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', legalReference: '', field: 'mrp', operator: 'exists', value: '', severity: 'MEDIUM', category: 'MRP' });

  async function load() {
    const res = await fetch('/api/rules');
    const d = await res.json();
    if (d.success) setRules(d.data);
  }
  useEffect(() => {
    load();
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      setCanWrite(!!u && ['SUPER_ADMIN', 'REGULATORY_ADMIN'].includes(u.role));
    } catch {}
  }, []);

  const filtered = rules.filter(r => {
    const s = search.toLowerCase();
    return !s || r.ruleCode.toLowerCase().includes(s) || r.title.toLowerCase().includes(s) || r.description.toLowerCase().includes(s);
  });

  const createRule = async () => {
    setSaving(true); setCreateError('');
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          legalReference: form.legalReference || 'LM-PC-2011',
          category: form.category,
          severity: form.severity,
          validationLogic: form.operator === 'exists' ? { field: form.field, operator: 'exists' } : { field: form.field, operator: form.operator, value: form.value },
          status: 'DRAFT',
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d?.error?.message || 'Could not save the rule');
      setShowCreate(false);
      setForm({ title: '', description: '', legalReference: '', field: 'mrp', operator: 'exists', value: '', severity: 'MEDIUM', category: 'MRP' });
      await load();
    } catch (e: any) {
      setCreateError(e.message || 'Could not save the rule');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Rules Library" inPlainWords="The checklist the AI validates every label against. These are real legal requirements — changing them changes future inspections, never past ones.">
        {canWrite && <Button className="rounded-full" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Draft a rule</Button>}
      </PageHeader>

      <Explainer title="Where do these rules come from?" defaultOpen={false}>
        <p>Each rule is one legal requirement from the Legal Metrology (Packaged Commodities) Rules, 2011, stored as data — a field to look at, a test, and how serious a miss is. The platform contains no hard-coded regulation: publish a new version here and new inspections follow it.</p>
      </Explainer>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search rules…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Badge variant="outline" className="px-3 py-1.5">Active checklist: v1.2 • {rules.filter(r => r.status === 'PUBLISHED').length} rules in force</Badge>
      </div>

      <div className="grid gap-3">
        {filtered.map((rule) => {
          const st = STATUS_PLAIN[rule.status] || { label: rule.status, variant: 'secondary' };
          return (
            <Card key={rule.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-wrap justify-between gap-4">
                  <div className="flex gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center flex-shrink-0"><Scale className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm">{rule.ruleCode}</span>
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                        <SeverityBadge severity={rule.severity} />
                        {rule.requirementType !== 'MANDATORY' && <Badge variant="outline" className="text-[10px]" title="Applies only in some situations">{rule.requirementType === 'CONDITIONAL' ? 'Conditional' : 'Recommended'}</Badge>}
                      </div>
                      <div className="font-medium mt-1">{rule.title}</div>
                      <div className="text-sm text-muted-foreground mt-1 max-w-2xl">{rule.description}</div>
                    </div>
                  </div>
                  <Link href={`/app/rules/${rule.id}`}><Button size="sm" variant="outline" className="rounded-full h-8 self-start"><Eye className="w-3 h-3 mr-1" />Details</Button></Link>
                </div>
                <div className="mt-3 p-3 rounded-xl bg-stone-50 border text-sm">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mr-2">Check:</span>
                  <span className="font-medium">{describeLogic(rule.validationLogic)}</span>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">({rule.legalReference})</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="border-dashed shadow-none"><CardContent className="p-10 text-center text-muted-foreground">No rules match “{search}”.</CardContent></Card>}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4" onClick={() => !saving && setShowCreate(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg border shadow-xl p-6 space-y-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Draft a new rule</h2>
              <button onClick={() => setShowCreate(false)} aria-label="Close"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <p className="text-sm text-muted-foreground">New rules start as a <strong>Draft</strong> — they affect nothing until approved and published. That&rsquo;s deliberate: legal checklists change carefully.</p>
            <div className="space-y-3">
              <div className="space-y-1"><Label>What must the label have? (title)</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Complaint contact number" /></div>
              <div className="space-y-1"><Label>Plain explanation</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Shown to officers and in reports" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Look at field</Label>
                  <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.field} onChange={e => setForm({ ...form, field: e.target.value })}>
                    {['mrp', 'net_quantity', 'manufacturer_address', 'product_name', 'customer_care', 'manufacture_date', 'unit_sale_price'].map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><Label>Test</Label>
                  <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value })}>
                    <option value="exists">must be present</option>
                    <option value="contains">must contain</option>
                    <option value="gte">must be at least</option>
                    <option value="lte">must be at most</option>
                    <option value="regex">must match pattern</option>
                  </select>
                </div>
              </div>
              {form.operator !== 'exists' && <div className="space-y-1"><Label>Compare against</Label><Input value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Severity</Label>
                  <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                    <option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
                  </select>
                </div>
                <div className="space-y-1"><Label>Category</Label>
                  <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {['MRP', 'NET_QUANTITY', 'MANUFACTURER_INFO', 'PRODUCT_IDENTITY', 'CONSUMER_CARE', 'DATE_DECLARATION', 'READABILITY', 'UNIT_PRICE'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="rounded-lg bg-stone-50 border p-3 text-sm"><span className="text-xs uppercase text-muted-foreground font-semibold mr-2">Preview:</span>{describeLogic({ field: form.field, operator: form.operator as any, value: form.value || undefined })}</div>
              {createError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">{createError}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" disabled={saving} onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="rounded-full" disabled={saving || !form.title.trim()} onClick={createRule}>{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save as draft'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
