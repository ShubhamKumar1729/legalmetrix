import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, Scan, Brain, Scale, FileCheck, Eye, 
  Globe, Smartphone, BarChart3, Clock, AlertTriangle,
  CheckCircle2, Languages, Search, Lock, ArrowRight,
  Zap, Database, Users, FileText
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gov-gradient flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-[15px] tracking-tight">PackComply</div>
              <div className="text-[10px] text-muted-foreground -mt-1 font-medium tracking-widest uppercase">GovTech • SIH 26034</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium hover:text-primary">Login</Link>
            <Link href="/app/dashboard">
              <Button size="sm" className="rounded-full px-5">Open Platform</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50/50" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6 rounded-full px-3 py-1 text-xs font-medium border-blue-200 bg-blue-50 text-blue-700">
              Ministry of Consumer Affairs • Dept of Consumer Affairs
            </Badge>
            <h1 className="text-5xl md:text-[64px] font-bold tracking-tight leading-[0.95] mb-6">
              AI-Powered <br />
              <span className="text-primary">Packaged Commodity</span> <br />
              Compliance
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
              Enforcement-grade platform that helps officers scan, analyze, validate, review and document packaged commodity compliance under Legal Metrology Rules, 2011 — with evidence, confidence scoring, and auditability.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/app/scan">
                <Button size="lg" className="rounded-full px-8 h-12 text-base">
                  Start Inspection <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/app/dashboard">
                <Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-base">
                  Explore Platform
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                <span className="font-medium">Rule Engine • Versioned</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center"><Brain className="w-4 h-4 text-blue-600" /></div>
                <span className="font-medium">Mock AI • Pluggable Real Model</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center"><Lock className="w-4 h-4 text-amber-600" /></div>
                <span className="font-medium">RBAC • Audit Trail</span>
              </div>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="mt-16 md:mt-20 relative">
            <div className="rounded-[20px] border bg-white shadow-2xl shadow-blue-100/50 overflow-hidden">
              <div className="border-b bg-muted/30 px-6 py-3 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-amber-400" /><div className="w-3 h-3 rounded-full bg-green-400" /></div>
                <span className="text-xs font-medium text-muted-foreground ml-3">Enforcement Dashboard • Live</span>
              </div>
              <div className="grid md:grid-cols-4 gap-4 p-6 bg-gradient-to-br from-white to-slate-50/50">
                {[
                  { label: 'Total Inspections', value: '2,847', change: '+12%', color: 'text-slate-900' },
                  { label: 'Compliant', value: '1,923', change: '67.5%', color: 'text-emerald-600' },
                  { label: 'Violations', value: '412', change: '14.5%', color: 'text-red-600' },
                  { label: 'Review Required', value: '512', change: '18%', color: 'text-amber-600' },
                ].map((kpi) => (
                  <Card key={kpi.label} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground font-medium">{kpi.label}</div>
                      <div className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{kpi.change} vs last month</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-24 bg-slate-50/50 border-y">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Manual inspection doesn&apos;t scale</h2>
            <p className="text-muted-foreground text-lg">Enforcement officers face thousands of SKUs, multilingual labels, and e-commerce complexity.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: 'Time-Consuming Verification', desc: 'Checking MRP, quantity, manufacturer, customer-care, font size manually for each package takes 10-15 minutes.' },
              { icon: Search, title: 'Large Product Universe', desc: 'Millions of packaged commodities across food, cosmetics, electronics with frequent re-packaging.' },
              { icon: Globe, title: 'E-commerce Compliance Gap', desc: 'Online listings often mismatch physical package declarations — MRP, quantity, manufacturer.' },
            ].map((item) => (
              <Card key={item.title} className="border-0 shadow-sm bg-white">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4"><item.icon className="w-5 h-5" /></div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution flow */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4 rounded-full">Solution Architecture</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Capture → AI → Rules → Review → Evidence → Report → Intelligence</h2>
          </div>
          <div className="grid md:grid-cols-7 gap-4 items-center">
            {[
              { icon: Scan, label: 'Capture', sub: 'Multi-image upload' },
              { icon: Brain, label: 'AI Analysis', sub: 'OCR + Extraction' },
              { icon: Scale, label: 'Rule Validation', sub: 'LM-PC-2011 Engine' },
              { icon: Eye, label: 'Human Review', sub: 'Confidence routing' },
              { icon: Database, label: 'Evidence', sub: 'Geo-tagged, immutable' },
              { icon: FileText, label: 'Report', sub: 'PDF + Audit' },
              { icon: BarChart3, label: 'Intelligence', sub: 'Repeat offender' },
            ].map((step, i) => (
              <div key={step.label} className="relative">
                <div className="rounded-2xl border bg-white p-5 text-center card-shadow hover:card-shadow-hover transition-shadow">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3"><step.icon className="w-5 h-5" /></div>
                  <div className="font-semibold text-sm">{step.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{step.sub}</div>
                </div>
                {i < 6 && <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-slate-200" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Built for enforcement, not demos</h2>
            <p className="text-slate-400 text-lg">Every feature maps to Legal Metrology Rules, 2011 requirements.</p>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { icon: Scan, title: 'AI Scanning', desc: 'Multi-side capture, quality check' },
              { icon: Languages, title: 'Multilingual', desc: 'EN, HI, PA script detection' },
              { icon: Scale, title: 'Rule Engine', desc: 'JSON DSL, versioned, no code' },
              { icon: Zap, title: 'Confidence', desc: '90%/75% thresholds, configurable' },
              { icon: Users, title: 'Human Review', desc: 'Accept, reject, correct, audit' },
              { icon: Globe, title: 'E-commerce', desc: 'Listing vs package mismatch' },
              { icon: Smartphone, title: 'Field Ready', desc: 'Mobile-first, offline queue' },
              { icon: BarChart3, title: 'Analytics', desc: 'Repeat offender, risk scoring' },
              { icon: FileCheck, title: 'Reports', desc: 'Evidence-backed PDF' },
              { icon: Lock, title: 'Auditability', desc: 'Immutable trail, RBAC' },
            ].map((f) => (
              <Card key={f.title} className="bg-slate-800 border-slate-700 text-white">
                <CardContent className="p-5">
                  <f.icon className="w-5 h-5 mb-3 text-blue-400" />
                  <div className="font-medium text-sm">{f.title}</div>
                  <div className="text-xs text-slate-400 mt-1 leading-relaxed">{f.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-6">Trust & Security by Design</h2>
              <div className="space-y-4">
                {[
                  { title: 'Role-Based Access Control', desc: '6 roles: Super Admin, Regulatory Admin, Enforcement Officer, Reviewer, Analyst, Auditor. Backend-enforced.' },
                  { title: 'Immutable Audit Trail', desc: 'Every inspection, AI result, rule change, review decision logged with user, timestamp, old/new values.' },
                  { title: 'Configurable Rule Versions', desc: 'Never overwrite history. Draft → Validation → Approved → Published → Archived. Reports remain reproducible.' },
                  { title: 'Evidence Preservation', desc: 'Geo-tagged images, bounding boxes, cropped evidence, AI model version, rule-set version all linked.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div><div className="font-medium text-sm">{item.title}</div><div className="text-sm text-muted-foreground mt-1">{item.desc}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <Card className="border shadow-sm">
              <CardContent className="p-6">
                <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4">Demo Credentials</div>
                <div className="space-y-3 text-sm">
                  {[
                    { role: 'Enforcement Officer', email: 'officer@gov.in', pass: 'Gov@2026' },
                    { role: 'Reviewer', email: 'reviewer@gov.in', pass: 'Gov@2026' },
                    { role: 'Super Admin', email: 'admin@gov.in', pass: 'Gov@2026' },
                    { role: 'Analyst', email: 'analyst@gov.in', pass: 'Gov@2026' },
                  ].map((c) => (
                    <div key={c.email} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div><div className="font-medium">{c.role}</div><div className="text-xs text-muted-foreground">{c.email}</div></div>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{c.pass}</code>
                    </div>
                  ))}
                </div>
                <Link href="/login" className="mt-6 block"><Button className="w-full rounded-full">Login to Platform</Button></Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Begin a Compliance Inspection</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">Experience the full flow: capture → AI analysis → rule validation → human review → report. Deterministic demo data for reliable jury presentation.</p>
          <Link href="/app/scan"><Button size="lg" className="rounded-full px-8 h-12">Start Inspection <ArrowRight className="ml-2 w-4 h-4" /></Button></Link>
        </div>
      </section>

      <footer className="border-t py-10">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between gap-4 text-sm text-muted-foreground">
          <div>© 2026 PackComply • SIH Problem Statement 26034 • Ministry of Consumer Affairs</div>
          <div className="flex gap-6"><span>AI-Assisted • Human-Decided</span><span>Demo Data Only</span></div>
        </div>
      </footer>
    </div>
  );
}
