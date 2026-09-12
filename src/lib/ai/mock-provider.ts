import type { AIAnalyzeRequest, AIAnalyzeResponse, AIModelProvider, AIProcessingStage } from './types';
import type { ExtractedField, Finding, BoundingBox } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * MockAIProvider - Realistic deterministic mock for SIH demo
 * Simulates full AI pipeline without external dependencies
 * Future real model can replace this by implementing AIModelProvider interface
 */

const PROCESSING_STAGES_TEMPLATE: Omit<AIProcessingStage, 'startedAt' | 'completedAt' | 'progress' | 'status'>[] = [
  { id: 'image-quality', name: 'Image Quality Analysis', message: 'Analyzing resolution, blur, brightness' },
  { id: 'ocr', name: 'OCR Text Extraction', message: 'Extracting text regions with multilingual support' },
  { id: 'text-region', name: 'Text Region Detection', message: 'Detecting declaration zones' },
  { id: 'declaration-detection', name: 'Declaration Detection', message: 'Identifying mandatory declarations' },
  { id: 'entity-extraction', name: 'Entity Extraction', message: 'Parsing MRP, quantity, manufacturer, etc.' },
  { id: 'multilingual', name: 'Multilingual Matching', message: 'Normalizing across scripts (EN/HI/PA)' },
  { id: 'mrp-analysis', name: 'MRP Analysis', message: 'Validating MRP format and visibility' },
  { id: 'quantity-analysis', name: 'Net Quantity Analysis', message: 'Checking quantity declaration standards' },
  { id: 'font-analysis', name: 'Font & Readability Analysis', message: 'Estimating font size and contrast' },
  { id: 'rule-validation', name: 'Rule Validation', message: 'Evaluating against LM-PC-2011 rule set' },
  { id: 'confidence-scoring', name: 'Confidence Scoring', message: 'Calculating AI confidence metrics' },
  { id: 'final-decision', name: 'Final Decision Synthesis', message: 'Generating compliance assessment' },
];

function createBoundingBox(index: number): BoundingBox {
  // Deterministic bounding boxes for demo
  const boxes = [
    { x: 45, y: 80, width: 280, height: 55 },
    { x: 45, y: 145, width: 200, height: 30 },
    { x: 45, y: 185, width: 180, height: 28 },
    { x: 45, y: 220, width: 220, height: 32 },
    { x: 45, y: 260, width: 260, height: 50 },
    { x: 120, y: 300, width: 80, height: 25 },
    { x: 120, y: 340, width: 100, height: 22 },
  ];
  return boxes[index % boxes.length];
}

function getDeterministicMockData(inspectionId: string, productName?: string): {
  extractedFields: ExtractedField[],
  findings: Finding[],
  confidence: { average: number, min: number, max: number }
} {
  const lowerName = (productName || '').toLowerCase();
  const isFreshBite = lowerName.includes('freshbite') || inspectionId.includes('001042') || inspectionId.includes('insp-001');
  const isPureHarvest = lowerName.includes('pureharvest') || lowerName.includes('basmati');
  const isCleanCare = lowerName.includes('cleancare') || lowerName.includes('shampoo');
  const isDailyGlow = lowerName.includes('dailyglow') || lowerName.includes('soap');
  const isNutriPack = lowerName.includes('nutripack') || lowerName.includes('atta');

  const now = new Date().toISOString();
  const imgId = `img-${inspectionId}-front`;

  if (isFreshBite) {
    // Demo scenario: 82% score, REVIEW_REQUIRED, 1 missing, 1 low confidence
    const fields: ExtractedField[] = [
      {
        id: `ef-${inspectionId}-1`,
        fieldName: 'mrp',
        value: '₹99',
        normalizedValue: '99.00',
        rawText: 'MRP Rs. 99/- (Incl. of all taxes)',
        language: 'en',
        script: 'Latin',
        confidence: 98,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(5),
        status: 'PASS',
        editable: true,
        reviewStatus: 'AI_CONFIRMED',
        ruleCode: 'LM-PC-2011-6(1)(e)',
      },
      {
        id: `ef-${inspectionId}-2`,
        fieldName: 'net_quantity',
        value: '500 g',
        normalizedValue: '500',
        rawText: 'Net Wt. 500g',
        language: 'en',
        script: 'Latin',
        confidence: 96,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(6),
        status: 'PASS',
        editable: true,
        reviewStatus: 'AI_CONFIRMED',
        ruleCode: 'LM-PC-2011-6(1)(c)',
      },
      {
        id: `ef-${inspectionId}-3`,
        fieldName: 'manufacturer_address',
        value: 'FreshBite Foods Pvt Ltd, GT Road, Ludhiana - 141001',
        normalizedValue: 'FreshBite Foods Pvt Ltd, GT Road, Ludhiana',
        rawText: 'Mfd. by: FreshBite Foods Pvt Ltd, GT Road, Ludhiana - 141001',
        language: 'en',
        script: 'Latin',
        confidence: 71,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(0),
        status: 'REVIEW',
        editable: true,
        reviewStatus: 'PENDING',
        ruleCode: 'LM-PC-2011-6(1)(a)',
      },
      {
        id: `ef-${inspectionId}-4`,
        fieldName: 'product_name',
        value: 'FreshBite Premium Biscuits',
        normalizedValue: 'FreshBite Premium Biscuits',
        rawText: 'FreshBite Premium Biscuits',
        language: 'en',
        script: 'Latin',
        confidence: 94,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(1),
        status: 'PASS',
        editable: true,
        reviewStatus: 'AI_CONFIRMED',
      },
      {
        id: `ef-${inspectionId}-5`,
        fieldName: 'manufacture_date',
        value: '08/2026',
        normalizedValue: '2026-08',
        rawText: 'PKD: 08/2026',
        language: 'en',
        script: 'Latin',
        confidence: 88,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(2),
        status: 'PASS',
        editable: true,
        reviewStatus: 'AI_CONFIRMED',
      },
      {
        id: `ef-${inspectionId}-6`,
        fieldName: 'customer_care',
        value: '',
        normalizedValue: '',
        rawText: '',
        language: 'en',
        script: 'Latin',
        confidence: 94,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(0),
        status: 'VIOLATION',
        editable: true,
        reviewStatus: 'PENDING',
      },
    ];

    const findings: Finding[] = [
      {
        id: `find-${inspectionId}-1`,
        inspectionId,
        declarationType: 'MRP',
        title: 'MRP Declaration',
        description: 'Retail sale price declaration found and valid per Rule 6(1)(e)',
        detectedValue: '₹99',
        expectedValue: 'MRP Rs. ... inclusive of all taxes',
        status: 'PASS',
        severity: 'CRITICAL',
        confidence: 98,
        ruleId: 'rule-004',
        ruleCode: 'LM-PC-2011-6(1)(e)',
        legalReference: 'Rule 6(1)(e)',
        evidence: [{ imageId: imgId, boundingBox: createBoundingBox(5) }],
        reviewStatus: 'AI_CONFIRMED',
        createdAt: now,
      },
      {
        id: `find-${inspectionId}-2`,
        inspectionId,
        declarationType: 'NET_QUANTITY',
        title: 'Net Quantity Declaration',
        description: 'Net quantity 500g declared in standard unit',
        detectedValue: '500 g',
        expectedValue: 'Standard unit g/kg/ml/L',
        status: 'PASS',
        severity: 'CRITICAL',
        confidence: 96,
        ruleId: 'rule-003',
        ruleCode: 'LM-PC-2011-6(1)(c)',
        legalReference: 'Rule 6(1)(c)',
        evidence: [{ imageId: imgId, boundingBox: createBoundingBox(6) }],
        reviewStatus: 'AI_CONFIRMED',
        createdAt: now,
      },
      {
        id: `find-${inspectionId}-3`,
        inspectionId,
        declarationType: 'MANUFACTURER',
        title: 'Manufacturer Address - Low Confidence',
        description: 'Manufacturer address detected but confidence 71% due to small font and partial occlusion. Requires human review.',
        detectedValue: 'FreshBite Foods Pvt Ltd, GT Road, Ludhiana - 141001',
        expectedValue: 'Complete address with PIN',
        status: 'REVIEW',
        severity: 'CRITICAL',
        confidence: 71,
        ruleId: 'rule-001',
        ruleCode: 'LM-PC-2011-6(1)(a)',
        legalReference: 'Rule 6(1)(a)',
        evidence: [{ imageId: imgId, boundingBox: createBoundingBox(0) }],
        reviewStatus: 'PENDING',
        createdAt: now,
      },
      {
        id: `find-${inspectionId}-4`,
        inspectionId,
        declarationType: 'CUSTOMER_CARE',
        title: 'Consumer Care Details Missing',
        description: 'Customer care name, address, phone, email not found. Mandatory per Rule 6(1)(f)',
        status: 'VIOLATION',
        severity: 'HIGH',
        confidence: 94,
        ruleId: 'rule-005',
        ruleCode: 'LM-PC-2011-6(1)(f)',
        legalReference: 'Rule 6(1)(f)',
        evidence: [],
        reviewStatus: 'PENDING',
        createdAt: now,
      },
    ];

    return {
      extractedFields: fields,
      findings,
      confidence: { average: 89, min: 71, max: 98 }
    };
  }

  if (isPureHarvest) {
    // Compliant example
    const fields: ExtractedField[] = [
      {
        id: `ef-${inspectionId}-1`,
        fieldName: 'mrp',
        value: '₹450',
        normalizedValue: '450.00',
        rawText: 'MRP ₹450/-',
        language: 'en',
        script: 'Latin',
        confidence: 99,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(5),
        status: 'PASS',
        editable: true,
        reviewStatus: 'AI_CONFIRMED',
      },
      {
        id: `ef-${inspectionId}-2`,
        fieldName: 'net_quantity',
        value: '5 kg',
        normalizedValue: '5000',
        rawText: 'Net Quantity: 5 kg',
        language: 'en',
        script: 'Latin',
        confidence: 97,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(6),
        status: 'PASS',
        editable: true,
        reviewStatus: 'AI_CONFIRMED',
      },
      {
        id: `ef-${inspectionId}-3`,
        fieldName: 'manufacturer_address',
        value: 'PureHarvest Agro Industries, Karnal, Haryana - 132001',
        normalizedValue: 'PureHarvest Agro Industries, Karnal',
        rawText: 'Mfd & Packed by PureHarvest Agro Industries, Karnal, Haryana',
        language: 'en',
        script: 'Latin',
        confidence: 96,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(0),
        status: 'PASS',
        editable: true,
        reviewStatus: 'AI_CONFIRMED',
      },
      {
        id: `ef-${inspectionId}-4`,
        fieldName: 'customer_care',
        value: '1800-123-4567, care@pureharvest.in',
        normalizedValue: '1800-123-4567',
        rawText: 'Consumer Care: 1800-123-4567, care@pureharvest.in',
        language: 'en',
        script: 'Latin',
        confidence: 95,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(4),
        status: 'PASS',
        editable: true,
        reviewStatus: 'AI_CONFIRMED',
      },
    ];
    const findings: Finding[] = fields.map((f, i) => ({
      id: `find-${inspectionId}-${i}`,
      inspectionId,
      declarationType: f.fieldName.toUpperCase(),
      title: `${f.fieldName} declaration`,
      description: `${f.fieldName} found and compliant`,
      detectedValue: f.value,
      status: 'PASS' as const,
      severity: 'CRITICAL' as const,
      confidence: f.confidence,
      ruleId: `rule-00${i+1}`,
      ruleCode: f.ruleCode || `LM-PC-2011-6(1)`,
      legalReference: 'Rule 6',
      evidence: [{ imageId: f.sourceImageId, boundingBox: f.boundingBox }],
      reviewStatus: 'AI_CONFIRMED' as const,
      createdAt: now,
    }));
    return { extractedFields: fields, findings, confidence: { average: 96, min: 95, max: 99 } };
  }

  if (isCleanCare) {
    // Non-compliant
    const fields: ExtractedField[] = [
      {
        id: `ef-${inspectionId}-1`,
        fieldName: 'mrp',
        value: '',
        normalizedValue: '',
        rawText: '',
        language: 'en',
        script: 'Latin',
        confidence: 92,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(5),
        status: 'VIOLATION',
        editable: true,
        reviewStatus: 'PENDING',
      },
      {
        id: `ef-${inspectionId}-2`,
        fieldName: 'net_quantity',
        value: '200 ml (approx)',
        normalizedValue: '200',
        rawText: '200 ml (approx)',
        language: 'en',
        script: 'Latin',
        confidence: 65,
        sourceImageId: imgId,
        boundingBox: createBoundingBox(6),
        status: 'REVIEW',
        editable: true,
        reviewStatus: 'PENDING',
      },
    ];
    const findings: Finding[] = [
      {
        id: `find-${inspectionId}-1`,
        inspectionId,
        declarationType: 'MRP',
        title: 'MRP Missing',
        description: 'MRP not declared on package',
        status: 'VIOLATION',
        severity: 'CRITICAL',
        confidence: 92,
        ruleId: 'rule-004',
        ruleCode: 'LM-PC-2011-6(1)(e)',
        legalReference: 'Rule 6(1)(e)',
        evidence: [],
        reviewStatus: 'PENDING',
        createdAt: now,
      },
      {
        id: `find-${inspectionId}-2`,
        inspectionId,
        declarationType: 'NET_QUANTITY',
        title: 'Net Quantity Non-Standard',
        description: 'Quantity declared as approximate, violates standard declaration',
        detectedValue: '200 ml (approx)',
        status: 'VIOLATION',
        severity: 'HIGH',
        confidence: 88,
        ruleId: 'rule-003',
        ruleCode: 'LM-PC-2011-6(1)(c)',
        legalReference: 'Rule 6(1)(c)',
        evidence: [{ imageId: imgId, boundingBox: createBoundingBox(6) }],
        reviewStatus: 'PENDING',
        createdAt: now,
      },
    ];
    return { extractedFields: fields, findings, confidence: { average: 75, min: 65, max: 92 } };
  }

  // Generic compliant with one warning
  const fields: ExtractedField[] = [
    {
      id: `ef-${inspectionId}-1`,
      fieldName: 'mrp',
      value: '₹199',
      normalizedValue: '199.00',
      rawText: 'MRP ₹199',
      language: 'en',
      script: 'Latin',
      confidence: 93,
      sourceImageId: imgId,
      boundingBox: createBoundingBox(5),
      status: 'PASS',
      editable: true,
      reviewStatus: 'AI_CONFIRMED',
    },
    {
      id: `ef-${inspectionId}-2`,
      fieldName: 'net_quantity',
      value: '100 g',
      normalizedValue: '100',
      rawText: 'Net Wt 100g',
      language: 'en',
      script: 'Latin',
      confidence: 90,
      sourceImageId: imgId,
      boundingBox: createBoundingBox(6),
      status: 'PASS',
      editable: true,
      reviewStatus: 'AI_CONFIRMED',
    },
  ];
  const findings: Finding[] = [
    {
      id: `find-${inspectionId}-1`,
      inspectionId,
      declarationType: 'MRP',
      title: 'MRP Declaration',
      description: 'MRP found',
      detectedValue: '₹199',
      status: 'PASS',
      severity: 'CRITICAL',
      confidence: 93,
      ruleId: 'rule-004',
      ruleCode: 'LM-PC-2011-6(1)(e)',
      legalReference: 'Rule 6(1)(e)',
      evidence: [{ imageId: imgId, boundingBox: createBoundingBox(5) }],
      reviewStatus: 'AI_CONFIRMED',
      createdAt: now,
    },
  ];
  return { extractedFields: fields, findings, confidence: { average: 91, min: 90, max: 93 } };
}

export class MockAIProvider implements AIModelProvider {
  name = 'Mock Vision Compliance Model';
  version = process.env.AI_MODEL_VERSION || 'mock-vision-v0.1.0';

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async extractText(imageUrl: string): Promise<{ text: string; confidence: number; boundingBoxes: any[] }> {
    // Simulate OCR
    await new Promise(r => setTimeout(r, 200));
    return {
      text: 'MRP Rs. 99/- Net Wt. 500g Mfd by FreshBite Foods',
      confidence: 0.92,
      boundingBoxes: [createBoundingBox(0)],
    };
  }

  async analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResponse> {
    const runId = `ai-run-${uuidv4().slice(0, 8)}`;
    const start = Date.now();

    // Simulate processing stages with realistic timing
    const stages: AIProcessingStage[] = PROCESSING_STAGES_TEMPLATE.map((tpl, idx) => ({
      ...tpl,
      status: 'COMPLETED' as const,
      progress: 100,
      startedAt: new Date(start + idx * 150).toISOString(),
      completedAt: new Date(start + (idx + 1) * 150).toISOString(),
      details: idx === 1 ? { languagesDetected: ['en', 'hi'], scripts: ['Latin', 'Devanagari'] } : undefined,
    }));

    // For demo, add a warning on font analysis if needed
    const productName = request.productMetadata?.productName || '';
    if (productName.toLowerCase().includes('freshbite')) {
      stages[8] = {
        ...stages[8],
        status: 'WARNING',
        message: 'MRP font size near minimum threshold (1mm), review recommended',
      };
    }

    // Get deterministic mock data
    const mockData = getDeterministicMockData(request.inspectionId, productName);

    // Simulate processing delay
    await new Promise(r => setTimeout(r, 800));

    const response: AIAnalyzeResponse = {
      inspectionId: request.inspectionId,
      runId,
      processingStatus: 'COMPLETED',
      stages,
      extractedFields: mockData.extractedFields,
      findings: mockData.findings,
      confidence: mockData.confidence,
      evidenceRegions: mockData.extractedFields.map(f => ({
        imageId: f.sourceImageId,
        boundingBox: f.boundingBox,
        label: f.fieldName,
        confidence: f.confidence,
      })),
      warnings: productName.toLowerCase().includes('freshbite') 
        ? ['Consumer care missing - potential violation', 'Manufacturer address low confidence - review required']
        : [],
      modelMetadata: {
        provider: 'mock',
        modelName: this.name,
        modelVersion: this.version,
        processedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - start,
      },
    };

    return response;
  }
}

export const mockAIProvider = new MockAIProvider();
