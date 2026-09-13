import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, unauthorized } from '@/lib/auth/session';
import { storage } from '@/lib/storage/local-storage';

/** Serves stored evidence images to signed-in users only. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return unauthorized();

  const file = await storage.read(params.id);
  if (!file) {
    return NextResponse.json({ success: false, error: { message: 'Image not found' } }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
