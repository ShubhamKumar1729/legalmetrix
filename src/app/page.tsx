import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, Camera, ClipboardCheck, FileText, Scale, Brain,
  ArrowRight, CheckCircle2, Lock, Store, BarChart3, Smartphone,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg brand-gradient flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-[15px] tracking-tight">LegalMetrix</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5 font-medium tracking-widest uppercase">Package label compliance</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/app/guide" className="text-sm font-medium hover:text-primary hidden sm:block">How it works</Link>
            <Link href="/login"><Button size="sm" className="rounded-full px-5">Sign in</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/70 via-white to-stone-100/60" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6 rounded-full px-3 py-1 text-xs font-medium border-emerald-200 bg-emerald-50 text-emerald-800">
              For Legal Metrology enforcement officers
            </Badge>
            <h1 className="text-[44px] md:text-[60px] font-bold tracking-tight leading-[0.98] mb-6">
              Point a camera at a label. <br />
              <span className="text-primary">Know if it&apos;s compliant.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
              LegalMetrix photographs a packaged product, reads every detail the law requires (price, quantity, address, dates…),
              checks it against the 2011 rules — and only passes something when a human officer agrees.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/app/scan"><Button size="lg" className="rounded-full px-8 h-12 text-base">Start an inspection <ArrowRight className="ml-1 w-4 h-4" /></Button></Link>
              <Link href="/login"><Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-base">Try the demo account</Button></Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm">
              {[
                { icon: CheckCircle2, text: 'Evidence for every conclusion' },
                { icon: Scale, text: 'Rules you can edit — no re-coding' },
                { icon: Lock, text: 'Human decides; AI only assists' },
              ].map(f => (
                <div key={f.text} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><f.icon className="w-4 h-4 text-emerald-700" /></div>
                  <span className="font-medium">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Product preview */}
          <div className="mt-16 md:mt-20">
            <div className="rounded-[20px] border bg-white shadow-2xl shadow-emerald-100/60 overflow-hidden">
              <div className="border-b bg-stone-50 px-6 py-3 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-amber-400" /><div className="w-3 h-3 rounded-full bg-emerald-400" /></div>
                <span className="text-xs font-medium text-muted-foreground ml-3">Dashboard preview</span>
              </div>
              <div className="grid md:grid-cols-4 gap-4 p-6 bg-gradient-to-br from-white to-stone-50">
                {[
                  { label: 'Scans completed', value: '2,847', note: 'all time', color: 'text-stone-900' },
                  { label: 'Passed cleanly', value: '1,923', note: '67.5% of scans', color: 'text-emerald-600' },
                  { label: 'Problems found', value: '412', note: 'need action', color: 'text-red-600' },
                  { label: 'Waiting on a human', value: '512', note: 'review queue', color: 'text-amber-600' },
                ].map((kpi) => (
                  <Card key={kpi.label} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground font-medium">{kpi.label}</div>
                      <div className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{kpi.note}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-stone-50 border-y">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Four steps. Always the same four.</h2>
            <p className="text-muted-foreground text-lg">No menus to memorize — the app walks officers through one flow, and everything else is just looking things up.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { icon: Camera, n: 1, title: 'Scan the package', desc: 'Photograph the label, front and back. Nothing else to fill in first.' },
              { icon: Brain, n: 2, title: 'The AI reads it', desc: 'It finds each required declaration in any language and rates how sure it is.' },
              { icon: ClipboardCheck, n: 3, title: 'A human decides', desc: 'Anything the AI doubts lands in a review queue — accept, correct or reject with the photo as proof.' },
              { icon: FileText, n: 4, title: 'Report & archive', desc: 'Export a report citing the exact rule and version used. It can be re-checked years later.' },
            ].map(s => (
              <div key={s.n} className="rounded-2xl border bg-white p-5 card-shadow relative">
                <div className="absolute -top-3 left-5 w-7 h-7 rounded-full brand-gradient text-white text-sm font-bold flex items-center justify-center">{s.n}</div>
                <s.icon className="w-6 h-6 text-emerald-700 mt-2 mb-3" />
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold tracking-tight mb-10">What&apos;s inside</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Scale, title: 'Editable rule library', desc: 'The legal checklist lives in the database as plain rules — admins version and publish them; the UI never hard-codes law.' },
              { icon: Brain, title: 'Pluggable AI', desc: 'A demo model ships inside. Swap in your production vision model with three environment variables — nothing else changes.' },
              { icon: Store, title: 'Online listing checks', desc: 'Compare any e-commerce listing against the physical pack and catch price or quantity mismatches.' },
              { icon: BarChart3, title: 'Repeat-offender radar', desc: 'Who violates again and again, so limited field time goes where it matters.' },
              { icon: Lock, title: 'Court-ready audit trail', desc: 'Every view, edit and decision is logged, attributed and immutable.' },
              { icon: Smartphone, title: 'Field-mode & offline', desc: 'A camera-first screen for vans and warehouses; captures queue and sync later.' },
            ].map(f => (
              <Card key={f.title} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3"><f.icon className="w-5 h-5 text-emerald-700" /></div>
                  <div className="font-semibold">{f.title}</div>
                  <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + credentials */}
      <section className="py-20 border-t bg-stone-900 text-white">
        <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Try the full flow in two minutes</h2>
            <p className="text-stone-300 text-lg leading-relaxed mb-8">Sign in with the inspector account, scan the demo product, and go all the way from photo to signed report. All data is synthetic and safe to explore.</p>
            <Link href="/login"><Button size="lg" className="rounded-full px-8 bg-emerald-500 text-stone-950 hover:bg-emerald-400">Open the demo <ArrowRight className="ml-2 w-4 h-4" /></Button></Link>
          </div>
          <Card className="border border-stone-700 bg-stone-800 text-white shadow-none">
            <CardContent className="p-6">
              <div className="text-xs font-semibold tracking-widest uppercase text-stone-400 mb-4">Demo accounts (password: Gov@2026)</div>
              <div className="space-y-2 text-sm">
                {[
                  { role: 'Inspector', email: 'officer@gov.in' },
                  { role: 'Reviewer', email: 'reviewer@gov.in' },
                  { role: 'Administrator', email: 'admin@gov.in' },
                  { role: 'Analyst', email: 'analyst@gov.in' },
                ].map(c => (
                  <div key={c.email} className="flex justify-between items-center py-2 border-b border-stone-700 last:border-0">
                    <div className="font-medium">{c.role}</div>
                    <code className="text-xs bg-stone-900 px-2 py-1 rounded text-stone-300">{c.email}</code>
                  </div>
                ))}
              </div>
              <Link href="/login" className="mt-5 block"><Button variant="outline" className="w-full rounded-full border-stone-600 text-white hover:bg-stone-700">Go to sign in</Button></Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="py-10 bg-stone-900 text-stone-500 border-t border-stone-800">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between gap-3 text-sm">
          <div>LegalMetrix — a demonstration build. AI-assisted assessment; final decisions belong to authorized officials. Not legal advice.</div>
          <div className="flex gap-5"><span>Demo data only</span><span>Zero blue. Promise. 🙂</span></div>
        </div>
      </footer>
    </div>
  );
}
