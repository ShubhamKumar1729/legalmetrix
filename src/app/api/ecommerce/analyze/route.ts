import { NextRequest, NextResponse } from 'next/server';
import { guardRequest } from '@/lib/auth/session';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const denied = guardRequest(req, 'ecommerce:analyze'); if (denied) return denied;
  const { url, packageInspectionId } = await req.json();

  if (!url) {
    return NextResponse.json({ success: false, error: { message: 'URL required' } }, { status: 400 });
  }

  // Mock e-commerce analysis
  const isAmazon = url.includes('amazon');
  const platform = isAmazon ? 'Amazon' : url.includes('flipkart') ? 'Flipkart' : 'Generic';

  // Simulate listing extraction
  await new Promise(r => setTimeout(r, 800));

  const listing = {
    id: uuidv4(),
    url,
    platform,
    productName: 'FreshBite Premium Biscuits - 500g Pack',
    brand: 'FreshBite',
    mrp: '₹99',
    netQuantity: '500 g',
    manufacturer: 'FreshBite Foods Pvt Ltd',
    images: ['/api/placeholder/image?text=Listing+Image'],
    extractedAt: new Date().toISOString(),
  };

  // Mock package data for comparison (if inspection provided, use it, else mock mismatch)
  const packageData = {
    mrp: '₹89', // Mismatch example
    netQuantity: '500 g',
    productName: 'FreshBite Premium Biscuits',
    manufacturer: 'FreshBite Foods Pvt Ltd, Ludhiana',
  };

  const comparison = [
    {
      field: 'MRP',
      listingValue: listing.mrp,
      packageValue: packageData.mrp,
      match: listing.mrp === packageData.mrp,
      status: listing.mrp === packageData.mrp ? 'PASS' : 'VIOLATION',
    },
    {
      field: 'Net Quantity',
      listingValue: listing.netQuantity,
      packageValue: packageData.netQuantity,
      match: listing.netQuantity === packageData.netQuantity,
      status: 'PASS',
    },
    {
      field: 'Product Name',
      listingValue: listing.productName,
      packageValue: packageData.productName,
      match: true,
      status: 'PASS',
    },
    {
      field: 'Manufacturer',
      listingValue: listing.manufacturer,
      packageValue: packageData.manufacturer,
      match: false,
      status: 'REVIEW',
    },
  ];

  return NextResponse.json({
    success: true,
    data: {
      listing,
      packageData,
      comparison,
      overallStatus: comparison.some(c => c.status === 'VIOLATION') ? 'MISMATCH' : 'MATCH',
      complianceScore: comparison.filter(c => c.match).length / comparison.length * 100,
    }
  });
}
