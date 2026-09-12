import { NextRequest, NextResponse } from 'next/server';
import { aiRegistry } from '@/lib/ai/provider';
import { guardRequest } from '@/lib/auth/session';

/**
 * GET /api/ai/status → which AI model is currently wired in, and how it's configured.
 * POST /api/ai/status → runs a live health check against the configured model service.
 */
export async function GET(req: NextRequest) {
  const denied = guardRequest(req);
  if (denied) return denied;
  return NextResponse.json({ success: true, data: aiRegistry.getStatus() });
}

export async function POST(req: NextRequest) {
  const denied = guardRequest(req);
  if (denied) return denied;
  const status = aiRegistry.getStatus();
  const started = Date.now();
  const healthy = await aiRegistry.healthCheck();
  return NextResponse.json({
    success: true,
    data: { ...status, healthy, latencyMs: Date.now() - started, checkedAt: new Date().toISOString() },
  });
}
