'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import Link from 'next/link';

const DEMO_ACCOUNTS = [
  { role: 'Inspector (officer)', email: 'officer@gov.in', does: 'Scans products & writes reports' },
  { role: 'Reviewer', email: 'reviewer@gov.in', does: 'Confirms or corrects AI findings' },
  { role: 'Administrator', email: 'admin@gov.in', does: 'Users, rules, settings' },
  { role: 'Analyst', email: 'analyst@gov.in', does: 'Trends, risk, repeat offenders' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('officer@gov.in');
  const [password, setPassword] = useState('Gov@2026');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        // The server also sets an httpOnly session cookie — this copy is for display only.
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        window.location.href = '/app/dashboard';
        return;
      }
      setError(data?.error?.message || `Sign-in failed (${res.status}). Check your email and password.`);
    } catch {
      setError('Could not reach the server. Is it running? Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-lg brand-gradient flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold">LegalMetrix</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-1">Scan · Review · Report</div>
            </div>
          </Link>

          <div className="mb-8">
            <h1 className="text-[28px] font-bold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground mt-2 text-sm">Use your official government account to open the inspection portal.</p>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Inspector Portal</CardTitle>
              <CardDescription>Demo system — sign in with any account below</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Official Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="officer@gov.in" required className="h-11" autoComplete="username" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required className="h-11 pr-10" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPass ? 'Hide password' : 'Show password'}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

                <Button type="submit" className="w-full h-11 rounded-full" disabled={loading}>
                  {loading ? 'Signing in…' : <><LogIn className="w-4 h-4 mr-2" /> Sign in</>}
                </Button>

                <div className="text-xs text-muted-foreground text-center pt-2 flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3" /> Secure session • your role decides what you can do • every action is logged
                </div>
              </form>

              <div className="mt-6 pt-6 border-t">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Try a demo account (password: Gov@2026)</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {DEMO_ACCOUNTS.map(a => (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => { setEmail(a.email); setPassword('Gov@2026'); setError(''); }}
                      className="text-left px-3 py-2 rounded-lg bg-muted hover:bg-accent border transition-colors"
                      title={a.does}
                    >
                      <div className="font-medium">{a.role}</div>
                      <div className="text-muted-foreground truncate">{a.email}</div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-xs text-muted-foreground text-center">
            Demonstration system. All data is synthetic — not connected to real government databases.
          </div>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 bg-stone-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 via-stone-900 to-stone-950/60" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs font-medium bg-white/10 border border-white/10 rounded-full px-3 py-1">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> System ready • AI: demo model active
          </div>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight mb-4">The AI reads the label. <br />You make the call.</h2>
          <p className="text-stone-300 text-lg leading-relaxed">LegalMetrix photographs a package, extracts every legally-required declaration, checks them against the 2011 rules, and routes anything uncertain to a human. Every decision is evidenced and logged.</p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { k: '4 min', v: 'Average inspection' },
              { k: '100%', v: 'Decisions human-confirmed' },
              { k: '∞', v: 'Audit trail retained' },
            ].map((stat) => (
              <div key={stat.v} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-2xl font-bold">{stat.k}</div>
                <div className="text-xs text-stone-400 mt-1">{stat.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-stone-500">
          Legal Metrology (Packaged Commodities) Rules, 2011 • Demo build
        </div>
      </div>
    </div>
  );
}
