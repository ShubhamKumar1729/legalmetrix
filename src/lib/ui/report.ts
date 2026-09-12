'use client';
export function reportToText(report: any) {
  return `LEGALMETRIX — COMPLIANCE REPORT
=====================================
Report ID:      ${report.reportId}
Inspection:     ${report.inspectionNumber}
Product:        ${report.productName} (${report.brand || '-'})
Manufacturer:   ${report.manufacturer || '-'}
Outcome:        ${report.status}
Score:          ${report.complianceScore}/100
Inspector:      ${report.inspector}
Date:           ${new Date(report.date).toLocaleString()}
Rule set used:  ${report.ruleVersion}
AI model used:  ${report.aiModel}
=====================================

This report is an AI-ASSISTED compliance assessment. The final enforcement
decision belongs to the authorized officer named above.

Evidence traceability:
Finding → Photo + highlighted region → AI reading → Rule (version above)
→ Human decision → This report. The audit log records every step.
(Demo build: text export. Production build renders the full PDF with images
and signatures via the same data.)
`;
}

export function downloadReport(report: any) {
  const blob = new Blob([reportToText(report)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.reportId}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

