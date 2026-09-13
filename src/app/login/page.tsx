'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, EyeOff, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthStatus {
  hasUsers: boolean;
  bootstrapConfigured: boolean;
  rulesPublished: number;
  aiDevelopmentMode: boolean;
  datastore: 'mongodb' | 'memory';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    fetch('/api/auth/status', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => body.success && setStatus(body.data))
      .catch(() => undefined);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (body.success) {
        window.location.href = '/app/dashboard';
        return;
      }
      setError(body.error?.message || 'Sign in failed.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 items-center justify-center bg-white p-6">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <div className="gov-gradient flex h-9 w-9 items-center justify-center rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold">LegalMetrix</div>
              <div className="-mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Packaged Commodity Compliance
              </div>
            </div>
          </Link>

          <div className="mb-8">
            <h1 className="text-[28px] font-bold tracking-tight">Sign in</h1>
            <p className="mt-2 text-muted-foreground">Use the account issued by your administrator.</p>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Inspection Portal</CardTitle>
              <CardDescription>Sessions are authenticated, authorised and audit logged.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
                )}

                <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'} <Lock className="ml-1 h-4 w-4" />
                </Button>
              </form>

              {status && !status.hasUsers && (
                <div className="mt-6 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">No accounts exist yet.</p>
                    <p className="mt-1">
                      {status.bootstrapConfigured
                        ? 'The bootstrap administrator is configured. Restart the application to create it.'
                        : 'Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the environment, then restart the application to create the first administrator.'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-slate-900 to-indigo-900/50" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium">
            Legal Metrology (Packaged Commodities) Rules, 2011
          </span>
        </div>
        <div className="relative">
          <h2 className="mb-4 text-4xl font-bold leading-tight">
            Capture the package.
            <br />
            Check every mandatory declaration.
          </h2>
          <p className="text-lg leading-relaxed text-slate-300">
            Inspections, findings, reviews and reports are stored against real evidence, with a configurable rule
            engine and a complete audit trail.
          </p>
          <ol className="mt-10 space-y-3 text-sm text-slate-300">
            {['Create an inspection', 'Capture or upload package images', 'Analyze against configured rules', 'Review flagged findings', 'Generate the compliance report'].map(
              (step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                    {index + 1}
                  </span>
                  {step}
                </li>
              )
            )}
          </ol>
        </div>
        <div className="relative text-xs text-slate-500">
          Department of Consumer Affairs · Legal Metrology Division
        </div>
      </div>
    </div>
  );
}
