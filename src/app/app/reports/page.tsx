"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => { if (d.success) setReports(d.data); });
  }, []);

  const downloadPDF = (report: any) => {
    // Generate simple PDF content via jsPDF would be done here
    // For demo, create a text file
    const content = `PackComply Compliance Report
Report ID: ${report.reportId}
Inspection: ${report.inspectionNumber}
Product: ${report.productName}
Status: ${report.status}
Score: ${report.complianceScore}/100
Inspector: ${report.inspector}
Date: ${new Date(report.date).toLocaleString()}
Rule Version: ${report.ruleVersion}
AI Model: ${report.aiModel}

This is a demo report. In production, PDF would be generated with evidence images, findings, audit trail, signatures.

Evidence traceability: Finding -> Evidence -> AI Output -> Rule -> Reviewer Decision -> Final Report
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reportId}.txt`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><div><h1 className="text-2xl font-bold tracking-tight">Compliance Reports</h1><p className="text-sm text-muted-foreground">Evidence-backed • Rule versioned • Audit included • PDF export</p></div><div className="flex gap-2"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search reports..." className="pl-9 w-[260px]" /></div></div></div>

      <Card className="border-0 shadow-sm"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-muted-foreground border-b bg-muted/30"><tr><th className="text-left p-3">Report ID</th><th className="text-left p-3">Inspection</th><th className="text-left p-3">Product</th><th className="text-left p-3">Status</th><th className="text-left p-3">Score</th><th className="text-left p-3">Date</th><th className="text-left p-3">Inspector</th><th className="text-left p-3">Rule Version</th><th className="text-left p-3">Actions</th></tr></thead><tbody>{reports.map((r: any) => (<tr key={r.id} className="border-b last:border-0 hover:bg-muted/20"><td className="p-3 font-mono text-xs">{r.reportId}</td><td className="p-3 font-mono text-xs">{r.inspectionNumber}</td><td className="p-3"><div className="font-medium">{r.productName}</div><div className="text-xs text-muted-foreground">{r.brand}</div></td><td className="p-3"><Badge variant={r.status === 'COMPLIANT' ? 'compliant' : r.status === 'NON_COMPLIANT' ? 'violation' : 'review'} className="text-[10px]">{r.status}</Badge></td><td className="p-3 font-bold">{r.complianceScore}</td><td className="p-3 text-xs">{new Date(r.date).toLocaleDateString()}</td><td className="p-3 text-xs">{r.inspector}</td><td className="p-3 text-xs font-mono">{r.ruleVersion}</td><td className="p-3 flex gap-1"><Link href={`/app/reports/${r.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3 h-3" /></Button></Link><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadPDF(r)}><Download className="w-3 h-3" /></Button></td></tr>))}</tbody></table></div></CardContent></Card>
    </div>
  );
}
