'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, Explainer } from '@/components/common/explainer';

const versions = [
  { version: '1.2', status: 'PUBLISHED', date: '2024-03-15', rules: 8, changes: 'Added unit-sale-price rule; updated minimum font-size wording' },
  { version: '1.1', status: 'ARCHIVED', date: '2023-08-10', rules: 7, changes: 'Added readability clause' },
  { version: '1.0', status: 'ARCHIVED', date: '2022-01-01', rules: 6, changes: 'First LM-PC-2011 checklist' },
  { version: '1.3-draft', status: 'DRAFT', date: '2026-09-10', rules: 9, changes: 'Draft: extra checks for e-commerce listings' },
];

const STATUS_PLAIN: Record<string, { label: string; variant: any }> = {
  PUBLISHED: { label: 'In force now', variant: 'compliant' },
  ARCHIVED: { label: 'Replaced', variant: 'secondary' },
  DRAFT: { label: 'Not live yet', variant: 'review' },
};

export default function RuleVersionsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="Rule versions" inPlainWords="Each entry is one published edition of the legal checklist. Inspections remember the edition they were judged against — forever." />

      <div className="grid gap-3">
        {versions.map(v => {
          const st = STATUS_PLAIN[v.status] || { label: v.status, variant: 'secondary' };
          return (
            <Card key={v.version} className="border-0 shadow-sm">
              <CardContent className="p-5 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold">LM-PC-2011-v{v.version}</span>
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    {v.status === 'PUBLISHED' && <span className="text-[11px] text-muted-foreground">new scans use this one</span>}
                  </div>
                  <div className="text-sm mt-1 text-foreground/90">{v.changes}</div>
                  <div className="text-xs text-muted-foreground mt-1">{v.date} • {v.rules} rules</div>
                </div>
                <div className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                  {v.status === 'ARCHIVED' ? 'Reports from this era still replay exactly as decided.' : v.status === 'DRAFT' ? 'Nothing uses it until an admin publishes it.' : 'Active checklist.'}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Explainer title="Why versions instead of just editing?" defaultOpen={false}>
        If a merchant disputes a 2024 penalty in 2027, the court needs to know the rules <em>as they were</em>. Storing the version per inspection proves the decision was correct at the time — even after the checklist changes. That&apos;s also why a rule can only go: draft → tested → approved → published → retired.
      </Explainer>

      <p className="text-[11px] text-muted-foreground">This screen shows prepared demo data; live draft/publish actions are on each rule&apos;s detail page.</p>
    </div>
  );
}
