import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import {
  compareListing,
  fetchListing,
  isEcommerceConfigured,
  ProviderNotConfiguredError,
} from '@/lib/ecommerce/provider';
import { logAudit } from '@/lib/audit/audit';

/**
 * Compares an online listing against a real inspection of the same product.
 * Listing data comes only from a configured provider — never from hard-coded values.
 */
export async function POST(req: NextRequest) {
  const user = requirePermission('ecommerce:analyze');
  if (isResponse(user)) return user;

  const { url, inspectionId } = await req.json().catch(() => ({}));
  if (!url) return badRequest('A listing URL is required.');
  if (!inspectionId) return badRequest('Select the inspection to compare the listing against.');

  const inspection = await db.inspections.get(String(inspectionId));
  if (!inspection) return badRequest('The selected inspection could not be found.');

  try {
    const listing = await fetchListing(String(url));
    const comparison = compareListing(listing, inspection);

    const record = await db.ecommerceListings.create({
      url: listing.url,
      platform: listing.platform,
      productName: listing.fields.productName || inspection.productName,
      brand: listing.fields.brand || inspection.brand,
      mrp: listing.fields.mrp,
      netQuantity: listing.fields.netQuantity,
      manufacturer: listing.fields.manufacturer,
      images: listing.fields.images || [],
      extractedAt: listing.extractedAt,
      complianceComparison: comparison,
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: 'ECOMMERCE_LISTING_ANALYZED',
      resource: 'ECOMMERCE_LISTING',
      resourceId: record.id,
      newValue: { url: listing.url, inspectionId: inspection.id },
    });

    return NextResponse.json({ success: true, data: { listing, comparison, listingId: record.id } });
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return NextResponse.json(
        { success: false, error: { code: 'PROVIDER_NOT_CONFIGURED', message: error.message } },
        { status: 501 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: (error as Error).message } },
      { status: 502 }
    );
  }
}

export async function GET() {
  const user = requirePermission('ecommerce:analyze');
  if (isResponse(user)) return user;
  return NextResponse.json({ success: true, data: { configured: isEcommerceConfigured() } });
}
