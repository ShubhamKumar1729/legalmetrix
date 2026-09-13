/**
 * E-commerce listing provider.
 *
 * The comparison pipeline is in place; the data source is not. A provider is only active
 * when ECOMMERCE_PROVIDER and ECOMMERCE_API_URL are configured, so the module never
 * invents listing data.
 */

export interface ListingFields {
  productName?: string;
  brand?: string;
  mrp?: string;
  netQuantity?: string;
  manufacturer?: string;
  images?: string[];
}

export interface ListingResult {
  url: string;
  platform: string;
  fields: ListingFields;
  extractedAt: string;
}

export interface EcommerceProvider {
  name: string;
  fetchListing(url: string): Promise<ListingResult>;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super(
      'No e-commerce provider is configured. Set ECOMMERCE_PROVIDER and ECOMMERCE_API_URL to connect a listing source.'
    );
    this.name = 'ProviderNotConfiguredError';
  }
}

class HttpListingProvider implements EcommerceProvider {
  name = 'http';

  async fetchListing(url: string): Promise<ListingResult> {
    const endpoint = process.env.ECOMMERCE_API_URL;
    if (!endpoint) throw new ProviderNotConfiguredError();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.ECOMMERCE_API_KEY) headers.Authorization = `Bearer ${process.env.ECOMMERCE_API_KEY}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(`Listing provider returned ${res.status}`);

    const data = await res.json();
    return {
      url,
      platform: data.platform || 'Unknown',
      fields: data.fields || {},
      extractedAt: new Date().toISOString(),
    };
  }
}

export function isEcommerceConfigured(): boolean {
  return Boolean(process.env.ECOMMERCE_PROVIDER && process.env.ECOMMERCE_API_URL);
}

export async function fetchListing(url: string): Promise<ListingResult> {
  if (!isEcommerceConfigured()) throw new ProviderNotConfiguredError();
  return new HttpListingProvider().fetchListing(url);
}

/** Compares a fetched listing against the declarations recorded on a real inspection. */
export function compareListing(
  listing: ListingResult,
  inspection: { productName: string; manufacturer: string; findings: { title: string; detectedValue?: string }[] }
) {
  const declared = (needle: string) =>
    inspection.findings.find((f) => f.title.toLowerCase().includes(needle))?.detectedValue || '';

  const pairs: { field: string; listingValue: string; packageValue: string }[] = [
    { field: 'Product name', listingValue: listing.fields.productName || '', packageValue: inspection.productName },
    { field: 'Manufacturer', listingValue: listing.fields.manufacturer || '', packageValue: inspection.manufacturer },
    { field: 'MRP', listingValue: listing.fields.mrp || '', packageValue: declared('mrp') },
    { field: 'Net quantity', listingValue: listing.fields.netQuantity || '', packageValue: declared('quantity') },
  ];

  return pairs.map((pair) => {
    const listingValue = (pair.listingValue || '').trim().toLowerCase();
    const packageValue = (pair.packageValue || '').trim().toLowerCase();
    const comparable = listingValue.length > 0 && packageValue.length > 0;
    const match = comparable && listingValue === packageValue;
    return {
      ...pair,
      match,
      status: !comparable ? ('REVIEW' as const) : match ? ('PASS' as const) : ('VIOLATION' as const),
    };
  });
}
