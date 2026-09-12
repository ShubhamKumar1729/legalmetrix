import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text') || 'Package Image';
  
  // Return SVG placeholder
  const svg = `
  <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f1f5f9"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="20" y="20" width="360" height="260" rx="12" fill="white" stroke="#e2e8f0" stroke-width="1"/>
    <g transform="translate(200,140)" text-anchor="middle">
      <circle cx="0" cy="-20" r="24" fill="#1e293b"/>
      <text y="-16" font-family="Inter" font-size="16" fill="white" font-weight="600">📦</text>
      <text y="15" font-family="Inter" font-size="14" fill="#334155" font-weight="600">${text.slice(0,24)}</text>
      <text y="32" font-family="Inter" font-size="11" fill="#94a3b8">Evidence • SIH Demo</text>
    </g>
    <g transform="translate(30,260)">
      <rect width="80" height="16" rx="8" fill="#eff6ff"/>
      <text x="10" y="11" font-family="Inter" font-size="9" fill="#2563eb">LM-PC-2011</text>
    </g>
  </svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
