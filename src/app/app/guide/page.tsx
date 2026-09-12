'use client';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice } from '@/components/common/explainer';
import { Camera, ScanSearch, UserCheck, FileCheck, ArrowRight } from 'lucide-react';
import { GLOSSARY, WORKFLOW_STEPS } from '@/lib/ui/labels';

const STEP_ICONS = [Camera, ScanSearch, UserCheck, FileCheck];

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Start Here"
        inPlainWords="Two minutes to understand the whole app. Read this once, then never again."
      >
        <Link href="/app/scan"><Button className="rounded-full">Begin a scan <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
      </PageHeader>

      <Notice tone="ok" icon={<span className="text-base">💡</span>}>
        <strong>The one rule that matters:</strong> the AI only suggests. A human officer always decides.
        Nothing becomes an official result until a person accepts, corrects, or rejects it — and that decision is permanently logged.
      </Notice>

      <section>
        <h2 className="font-semibold text-lg mb-3">The workflow — always these 4 steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {WORKFLOW_STEPS.map((s, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <Card key={s.n} className="border-0 shadow-sm">
                <CardContent className="p-5 flex gap-4">
                  <div className="w-11 h-11 rounded-xl brand-gradient text-white flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Step {s.n}</div>
                    <div className="font-semibold">{s.title}</div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.plain}</p>
                    <Link href={s.where} className="inline-flex items-center text-sm font-medium text-emerald-700 hover:underline mt-2">
                      Open {s.where.split('/').pop() === 'scan' ? 'Scan' : s.title} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-3">What each account can do</h2>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0 divide-y">
            {[
              { role: 'Inspector (officer)', who: 'officer@gov.in', can: 'Start scans, record findings, generate reports. Cannot change rules.' },
              { role: 'Reviewer', who: 'reviewer@gov.in', can: 'Work the Review Queue: accept, correct or reject AI findings. This is the human decision step.' },
              { role: 'Administrator', who: 'admin@gov.in', can: 'Everything: users, rules, rule versions, settings including the AI model connection.' },
              { role: 'Analyst', who: 'analyst@gov.in', can: 'Read-only intelligence: trends, repeat offenders, risk scores, report downloads.' },
            ].map(r => (
              <div key={r.role} className="p-4 flex flex-wrap gap-2 items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{r.role}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.who} • password: Gov@2026</div>
                </div>
                <div className="text-sm text-muted-foreground max-w-md">{r.can}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-3">Words you&apos;ll see, explained</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {GLOSSARY.map(g => (
            <div key={g.term} className="rounded-xl border bg-white p-3.5 card-shadow">
              <div className="font-medium text-sm">{g.term}</div>
              <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{g.plain}</div>
            </div>
          ))}
        </div>
      </section>

      <Notice tone="neutral">
        <strong>Where are the results of my scan?</strong> After the AI finishes you land on the inspection result screen (under &quot;New Scan&quot;).
        Anything the AI was unsure about also appears in your <Link href="/app/review" className="font-medium text-emerald-700 hover:underline">Review Queue</Link>.
        Finished cases appear in <Link href="/app/reports" className="font-medium text-emerald-700 hover:underline">Reports</Link> and in the product&apos;s history.
      </Notice>
    </div>
  );
}
