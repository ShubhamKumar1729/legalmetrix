"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Scale, Plus, Eye, Edit3 } from 'lucide-react';
import Link from 'next/link';

export default function RulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/rules').then(r => r.json()).then(d => { if (d.success) setRules(d.data); });
  }, []);

  const filtered = rules.filter(r => !search || r.ruleCode.toLowerCase().includes(search.toLowerCase()) || r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold tracking-tight">Regulatory Rule Management</h1><p className="text-sm text-muted-foreground">Database-backed • JSON DSL • Versioned • No hardcoded logic in UI</p></div>
        <Button className="rounded-full"><Plus className="w-4 h-4 mr-2" />Create Rule</Button>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Search rule code, title..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <Badge variant="outline" className="px-3">LM-PC-2011 • {rules.length} rules • v1.2 active</Badge>
      </div>

      <div className="grid gap-4">
        {filtered.map((rule) => (
          <Card key={rule.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Scale className="w-5 h-5" /></div>
                  <div>
                    <div className="flex items-center gap-2"><span className="font-mono font-bold text-sm">{rule.ruleCode}</span><Badge variant={rule.status === 'PUBLISHED' ? 'compliant' : rule.status === 'DRAFT' ? 'secondary' : 'review'} className="text-[10px]">{rule.status}</Badge><Badge variant="outline" className="text-[10px]">{rule.severity}</Badge></div>
                    <div className="font-medium mt-1">{rule.title}</div>
                    <div className="text-sm text-muted-foreground mt-1 max-w-2xl">{rule.description}</div>
                    <div className="flex gap-2 mt-2 text-xs"><span className="font-mono bg-muted px-2 py-0.5 rounded">{rule.category}</span><span className="text-muted-foreground">{rule.legalReference}</span><span className="text-muted-foreground">v{rule.version}</span></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/app/rules/${rule.id}`}><Button size="sm" variant="outline" className="rounded-full h-8"><Eye className="w-3 h-3 mr-1" />View</Button></Link>
                  <Button size="sm" variant="outline" className="rounded-full h-8"><Edit3 className="w-3 h-3 mr-1" />Edit</Button>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border text-xs font-mono">
                IF: {JSON.stringify(rule.validationLogic)} → THEN: {rule.requirementType} • Severity: {rule.severity} • Review: {rule.reviewRequired ? 'Required' : 'Not required'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
