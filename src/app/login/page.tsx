"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('officer@gov.in');
  const [password, setPassword] = useState('Gov@2026');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        window.location.href = '/app/dashboard';
      } else {
        setError(data.error?.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Using demo mode fallback.');
      // Fallback demo mode
      if (email.includes('@gov.in') && password === 'Gov@2026') {
        const mockToken = btoa(JSON.stringify({ email, role: email.includes('admin') ? 'SUPER_ADMIN' : email.includes('reviewer') ? 'REVIEWER' : email.includes('analyst') ? 'ANALYST' : 'ENFORCEMENT_OFFICER', name: email.split('@')[0] })) + '.' + btoa(JSON.stringify({ exp: Date.now() + 86400000 })) + '.signature';
        // Create a simple JWT-like token for demo
        const payload = { id: 'user-officer', email, name: email === 'officer@gov.in' ? 'Rajesh Kumar' : email === 'reviewer@gov.in' ? 'Priya Sharma' : 'Admin', role: email.includes('admin') ? 'SUPER_ADMIN' : email.includes('reviewer') ? 'REVIEWER' : email.includes('analyst') ? 'ANALYST' : 'ENFORCEMENT_OFFICER', officialId: 'GOV-001' };
        const token = btoa(JSON.stringify({ alg: 'HS256' })) + '.' + btoa(JSON.stringify(payload)) + '.demo';
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(payload));
        window.location.href = '/app/dashboard';
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-lg gov-gradient flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold">PackComply</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-1">GovTech • SIH 26034</div>
            </div>
          </Link>

          <div className="mb-8">
            <h1 className="text-[28px] font-bold tracking-tight">Official Login</h1>
            <p className="text-muted-foreground mt-2">Department of Consumer Affairs • Legal Metrology Division</p>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Enforcement Portal</CardTitle>
              <CardDescription>Use your official government credentials</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Official Email / ID</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="officer@gov.in" required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="h-11 pr-10" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

                <Button type="submit" className="w-full h-11 rounded-full" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Secure Login'} <Lock className="w-4 h-4 ml-1" />
                </Button>

                <div className="text-xs text-muted-foreground text-center pt-2">
                  Secure session • RBAC enforced • Audit logged
                </div>
              </form>

              <div className="mt-6 pt-6 border-t">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Demo Accounts (Gov@2026)</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    'officer@gov.in',
                    'reviewer@gov.in',
                    'admin@gov.in',
                    'analyst@gov.in',
                  ].map(e => (
                    <button key={e} onClick={() => setEmail(e)} className="text-left px-3 py-2 rounded-lg bg-muted hover:bg-accent border text-[12px]">
                      <div className="font-medium">{e.split('@')[0]}</div>
                      <div className="text-muted-foreground truncate">{e}</div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-xs text-muted-foreground text-center">
            This is a demonstration system for SIH 2026. All data is synthetic.<br />
            Not connected to real government databases.
          </div>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-slate-900 to-indigo-900/50" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs font-medium bg-white/10 border border-white/10 rounded-full px-3 py-1">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> System Operational • Mock AI Active
          </div>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight mb-4">AI-assisted compliance, <br />human-decided enforcement</h2>
          <p className="text-slate-400 text-lg leading-relaxed">Evidence-backed, auditable, configurable rule engine for Legal Metrology (Packaged Commodities) Rules, 2011. Built for field officers, reviewers, and regulators.</p>
          
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { k: '98%', v: 'AI Confidence' },
              { k: '82/100', v: 'Compliance Score' },
              { k: 'v1.2', v: 'Rule Set' },
            ].map((stat) => (
              <div key={stat.v} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-2xl font-bold">{stat.k}</div>
                <div className="text-xs text-slate-400 mt-1">{stat.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-slate-500">
          Ministry of Consumer Affairs, Food & Public Distribution<br />Department of Consumer Affairs • SIH 26034 Prototype
        </div>
      </div>
    </div>
  );
}
