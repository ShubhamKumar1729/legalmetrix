import { NextResponse } from 'next/server';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';

/** Listings that were actually analyzed. Empty until one is submitted. */
export async function GET() {
  const user = requirePermission('ecommerce:analyze');
  if (isResponse(user)) return user;

  const listings = await db.ecommerceListings.list({}, { sortDescBy: 'createdAt' });
  return NextResponse.json({ success: true, data: { listings, total: listings.length } });
}
