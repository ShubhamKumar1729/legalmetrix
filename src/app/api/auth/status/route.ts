import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/system/info';

export const dynamic = 'force-dynamic';

/** Public: tells the login screen whether any account exists yet. No credentials are exposed. */
export async function GET() {
  const system = await getSystemStatus();
  return NextResponse.json({
    success: true,
    data: {
      hasUsers: system.userCount > 0,
      bootstrapConfigured: system.bootstrapConfigured,
      rulesPublished: system.rulesPublished,
      aiDevelopmentMode: system.ai.developmentMode,
      datastore: system.datastore,
    },
  });
}
