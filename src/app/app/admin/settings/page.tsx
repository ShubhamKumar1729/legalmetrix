'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Explainer, Notice } from '@/components/common/explainer';
import { Loader2, Plug, CheckCircle2, XCircle } from 'lucide-react';

/**
 * System Settings — thresholds, scoring weights, and the AI model connection.
 * The AI section mirrors MODEL_INTEGRATION.md: the active provider comes from
 * environment config, so this page is your pre-flight check before wiring a
 * real model (AI_PROVIDER=real + AI_SERVICE_URL + AI_SERVICE_KEY in .env).
 */
export default function SettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  async function load() {
    try {
      const [c, a] = await Promise.all([
        fetch('/api/configuration').then(r => (r.ok ? r.json() : Promise.reject(new Error('Admin access needed for thresholds.')))),
        fetch('/api/ai/status').then(r => r.json()),
      ]);
      if (c.success) setConfig(c.data);
      else setError(c.error?.message || '');
      if (a.success) setAi(a.data);
    } catch (e: any) {
      setError(e.message || 'Could not load settings.');
    }
  }
  useEffect(() => { load(); }, []);

  const setNested = (section: string, key: string, value: any) =>
    setConfig({ ...config, [section]: { ...config[section], [key]: value } });

  const save = async () => {
    setSaving(true); setSaved(''); setError('');
    try {
      const res = await fetch('/api/configuration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai: config.ai, compliance: config.compliance }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d?.error?.message || 'Could not save');
      setSaved('Saved. New inspections use these values immediately; old records keep theirs.');
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/ai/status', { method: 'POST' });
      setTestResult(await res.json());
    } catch (e: any) {
      setTestResult({ success: false, error: { message: 'Could not reach the status endpoint' } });
    } finally { setTesting(false); }
  };

  if (!config && !error) return <div className="animate-pulse h-72 bg-muted rounded-xl" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" inPlainWords="The dials that change how strictly products are judged — and which AI model reads the labels." />

      {error && <Notice tone="warn">{error}</Notice>}

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">How certain must the AI be?</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <Label htmlFor="hi">Auto-pass above (%)</Label>
            <Input id="hi" type="number" value={config?.ai?.confidenceThresholdHigh ?? ''} onChange={e => setNested('ai', 'confidenceThresholdHigh', parseInt(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">Findings the AI rates at least this certain are marked “fine” without a human.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="med">Send to human below (%)</Label>
            <Input id="med" type="number" value={config?.ai?.confidenceThresholdMedium ?? ''} onChange={e => setNested('ai', 'confidenceThresholdMedium', parseInt(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">Under this certainty a reviewer must decide, even if the AI thinks it&rsquo;s fine.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pass-score">“Passed” needs a score of at least</Label>
            <Input id="pass-score" type="number" value={config?.compliance?.severityThresholds?.compliant ?? ''} onChange={e => setNested('compliance', 'severityThresholds', { ...config?.compliance?.severityThresholds, compliant: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Points deducted per problem severity</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'WARNING'].map(s => (
                <div key={s}>
                  <Label className="text-[11px] capitalize">{s.toLowerCase()}</Label>
                  <Input type="number" value={config?.compliance?.scoringWeights?.[s] ?? ''} onChange={e => setNested('compliance', 'scoringWeights', { ...config?.compliance?.scoringWeights, [s]: parseInt(e.target.value) || 0 })} className="h-9" />
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-3 pt-2 border-t">
            <Button className="rounded-full" onClick={save} disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save changes'}</Button>
            {saved && <span className="text-sm text-emerald-700">{saved}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Plug className="w-4 h-4" />AI model connection</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Which model reads the package photos. Ready for your real integration — no UI changes needed.</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={testConnection} disabled={testing}>
            {testing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Testing…</> : 'Test connection'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border p-3.5 bg-stone-50">
              <div className="text-xs uppercase text-muted-foreground font-semibold">Active provider</div>
              <div className="mt-1.5 flex items-center gap-2"><Badge variant={ai?.activeProvider === 'real' ? 'compliant' : 'secondary'}>{ai?.activeProvider || '…'}</Badge><span className="text-muted-foreground">set by <code className="text-xs">AI_PROVIDER</code></span></div>
            </div>
            <div className="rounded-xl border p-3.5 bg-stone-50">
              <div className="text-xs uppercase text-muted-foreground font-semibold">Model</div>
              <div className="mt-1.5 font-medium">{ai?.modelName || '—'} • v{ai?.modelVersion || '—'}</div>
            </div>
            <div className="rounded-xl border p-3.5 bg-stone-50">
              <div className="text-xs uppercase text-muted-foreground font-semibold">Service URL</div>
              <div className="mt-1.5">{ai?.serviceUrlConfigured ? <span className="font-mono text-xs">{ai.serviceUrl}</span> : <span className="text-amber-700">not set (mock in use)</span>}</div>
            </div>
            <div className="rounded-xl border p-3.5 bg-stone-50">
              <div className="text-xs uppercase text-muted-foreground font-semibold">Timeout</div>
              <div className="mt-1.5">{(ai?.timeoutMs || 60000) / 1000}s per request, then retry once</div>
            </div>
          </div>

          {testResult?.data && (
            <div className={`rounded-xl border p-3.5 text-sm flex items-center gap-2 ${testResult.data.healthy ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              {testResult.data.healthy ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
              {testResult.data.healthy
                ? `The ${testResult.data.activeProvider} provider answered in ${testResult.data.latencyMs}ms.`
                : testResult.data.activeProvider === 'mock'
                  ? 'Mock provider — it is always “healthy”; there is nothing external to reach.'
                  : 'The configured model service did not answer. Check AI_SERVICE_URL / AI_SERVICE_KEY and that the service is up.'}
            </div>
          )}

          <Explainer title="Plugging in your real model (3 steps)" defaultOpen={false}>
            <ol className="list-decimal ml-4 space-y-1.5">
              <li>Expose 3 endpoints on your service: <code>GET /health</code>, <code>POST /analyze</code>, <code>POST /extract-text</code> — the exact JSON shapes are in <strong>MODEL_INTEGRATION.md</strong>.</li>
              <li>Set in <code>.env</code>: <code>AI_PROVIDER=real</code>, <code>AI_SERVICE_URL=…</code>, <code>AI_SERVICE_KEY=…</code> (optional <code>AI_TIMEOUT_MS</code>), then restart the server.</li>
              <li>Press “Test connection”. Everything downstream — rule validation, review queue, reports — works unchanged. Long runs return <code>PROCESSING</code>; the UI polls <code>/api/inspections/[id]/results</code>.</li>
            </ol>
          </Explainer>
          <p className="text-xs text-muted-foreground">While the real model is being wired, demo mode keeps working: a failing external call falls back to the mock once, so nothing dead-ends.</p>
        </CardContent>
      </Card>
    </div>
  );
}
