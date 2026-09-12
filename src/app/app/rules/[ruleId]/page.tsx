"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function RuleDetailPage() {
  const params = useParams();
  const [rule, setRule] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/rules/${params.ruleId}`).then(r => r.json()).then(d => { if (d.success) setRule(d.data); });
  }, [params.ruleId]);

  if (!rule) return <div className="animate-pulse h-96 bg-muted rounded-xl" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{rule.ruleCode} • {rule.title}</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Rule Editor • Professional</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm"><div><div className="text-muted-foreground text-xs uppercase">Rule Code</div><div className="font-mono font-medium mt-1">{rule.ruleCode}</div></div><div><div className="text-muted-foreground text-xs uppercase">Version</div><div className="font-medium mt-1">v{rule.version} • {rule.status}</div></div></div>
          <div><div className="text-muted-foreground text-xs uppercase">Title</div><div className="font-medium mt-1">{rule.title}</div></div>
          <div><div className="text-muted-foreground text-xs uppercase">Description</div><div className="text-sm mt-1">{rule.description}</div></div>
          <div><div className="text-muted-foreground text-xs uppercase">Legal Reference</div><div className="font-mono text-sm mt-1">{rule.legalReference}</div></div>
          <div className="p-4 rounded-xl bg-slate-900 text-white font-mono text-xs">
            <div className="text-slate-400 uppercase tracking-widest text-[10px] mb-2">Validation Logic (Safe DSL - No Arbitrary JS)</div>
            {JSON.stringify(rule.validationLogic, null, 2)}
          </div>
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <div className="text-xs font-semibold text-blue-900">Rule Preview</div>
            <div className="text-sm mt-2 text-blue-800">IF: {rule.validationLogic.field} {rule.validationLogic.operator} {rule.validationLogic.value || ''} <br />THEN: {rule.requirementType} • {rule.severity} severity • Evidence required: {rule.evidenceRequired ? 'Yes' : 'No'}</div>
          </div>
        </CardContent></Card>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Publication Safety</CardTitle></CardHeader><CardContent className="space-y-2 text-xs">
            <div className="flex justify-between"><span>Status</span><Badge variant={rule.status === 'PUBLISHED' ? 'compliant' : 'review'}>{rule.status}</Badge></div>
            <div className="flex justify-between"><span>Effective From</span><span>{new Date(rule.effectiveFrom).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span>Severity</span><span>{rule.severity}</span></div>
            <div className="pt-3"><Button className="w-full rounded-full" size="sm">Publish New Version</Button><div className="text-[11px] text-muted-foreground mt-2">Workflow: DRAFT → VALIDATION → READY_FOR_APPROVAL → APPROVED → PUBLISHED • Requires explicit confirmation</div></div>
          </CardContent></Card>
          <Card className="border-0 shadow-sm bg-amber-50 border-amber-200"><CardContent className="p-4 text-xs"><div className="font-medium text-amber-900">Versioning Guarantee</div><div className="text-amber-800 mt-1">Historical inspections store exact rule-set version used. Reports remain reproducible even after rule changes. Never overwrite history.</div></CardContent></Card>
        </div>
      </div>
    </div>
  );
}
