'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice } from '@/components/common/explainer';
import { SeverityBadge } from '@/components/common/status-badges';
import { describeLogic } from '@/lib/ui/labels';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Version workflow: each button moves the rule one legal step forward.
const NEXT_STATUS: Record<string, { to: string; button: string; explain: string }> = {
  DRAFT: { to: 'VALIDATION', button: 'Send to validation', explain: 'Test the rule against sample inspections before anyone depends on it.' },
  VALIDATION: { to: 'READY_FOR_APPROVAL', button: 'Mark ready for approval', explain: 'Validation passed — ask an approver to sign off.' },
  READY_FOR_APPROVAL: { to: 'APPROVED', button: 'Approve', explain: 'Approved rules are staged; publishing activates them for new inspections.' },
  APPROVED: { to: 'PUBLISHED', button: 'Publish', explain: 'Publishing makes this the checklist for all NEW inspections. Past inspections keep their old version.' },
  PUBLISHED: { to: 'ARCHIVED', button: 'Retire this rule', explain: 'Retired rules stop applying to new inspections but stay in old reports.' },
};

export default function RuleDetailPage() {
  const params = useParams();
  const [rule, setRule] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    fetch(`/api/rules/${params.ruleId}`).then(r => r.json()).then(d => { if (d.success) setRule(d.data); });
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      setCanWrite(!!u && ['SUPER_ADMIN', 'REGULATORY_ADMIN'].includes(u.role));
    } catch {}
  }, [params.ruleId]);

  if (!rule) return <div className="animate-pulse h-96 bg-muted rounded-xl" />;

  const flow = NEXT_STATUS[rule.status];

  const advance = async () => {
    if (!flow) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: flow.to }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d?.error?.message || 'Could not update the rule');
      setRule(d.data);
    } catch (e: any) {
      setError(e.message || 'Could not update the rule');
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/app/rules" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="w-3 h-3" />All rules</Link>
      <PageHeader title={rule.title} inPlainWords={`${rule.ruleCode} • ${rule.description}`} />

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">What the rule says</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-muted-foreground text-xs uppercase">Rule code</div><div className="font-mono font-medium mt-1">{rule.ruleCode}</div></div>
              <div><div className="text-muted-foreground text-xs uppercase">Version</div><div className="font-medium mt-1">v{rule.version} • <Badge variant={rule.status === 'PUBLISHED' ? 'compliant' : 'secondary'} className="text-[10px] ml-1">{rule.status}</Badge></div></div>
              <div><div className="text-muted-foreground text-xs uppercase">Legal reference</div><div className="font-mono text-sm mt-1">{rule.legalReference}</div></div>
              <div><div className="text-muted-foreground text-xs uppercase">Applies to</div><div className="font-medium mt-1">{rule.applicableProductCategories?.join(', ') || 'All products'}</div></div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">In plain words</div>
              <div className="text-sm mt-1.5 text-emerald-900 font-medium">{describeLogic(rule.validationLogic)}</div>
              <div className="text-xs mt-2 text-emerald-800/80">If this fails, the inspection gets a <SeverityBadge severity={rule.severity} className="text-[10px] align-middle" /> finding{rule.reviewRequired ? ' and waits for a human reviewer' : ' immediately'}.</div>
            </div>

            <details className="rounded-xl border bg-stone-900 text-stone-100">
              <summary className="px-4 py-3 text-xs font-semibold uppercase tracking-widest cursor-pointer select-none text-stone-300">Exact machine check (for auditors &amp; the AI team)</summary>
              <pre className="px-4 pb-4 text-xs overflow-x-auto font-mono text-stone-300">{JSON.stringify(rule.validationLogic, null, 2)}</pre>
            </details>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Moving this rule forward</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Current state</span><Badge variant={rule.status === 'PUBLISHED' ? 'compliant' : 'secondary'}>{rule.status.replace(/_/g, ' ')}</Badge></div>
              <div className="text-xs text-muted-foreground leading-relaxed">Draft → being tested → ready for approval → approved → published → retired. Each step is logged; nothing jumps straight into force.</div>
              {flow ? (
                <>
                  <Notice tone="neutral">{flow.explain}</Notice>
                  {canWrite ? (
                    <Button className="w-full rounded-full" size="sm" disabled={busy} onClick={advance}>
                      {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</> : flow.button}
                    </Button>
                  ) : (
                    <div className="text-[11px] text-muted-foreground bg-stone-50 border rounded-lg p-2">Only admins change rule status. Sign in as admin@gov.in to try it.</div>
                  )}
                  {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}
                </>
              ) : <div className="text-xs text-muted-foreground">This rule is retired — kept only so old reports stay reproducible.</div>}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50 border-amber-200"><CardContent className="p-4 text-xs">
            <div className="font-semibold text-amber-900">Why versions matter</div>
            <div className="text-amber-800 mt-1 leading-relaxed">Every inspection records the exact checklist it was judged against. Even after you edit or retire this rule, old reports still replay correctly — that&rsquo;s what makes enforcement decisions defensible.</div>
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
