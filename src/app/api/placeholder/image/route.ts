import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get('text') || 'Package Image').replace(/[<>&"]/g, '').slice(0, 28);

  // Warm stone palette — deliberately NO blue-family colors (project rule).
  const svg = `
  <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Demo package photo: ${text}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f5f5f4"/>
        <stop offset="100%" stop-color="#e7e5e4"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="20" y="20" width="360" height="260" rx="12" fill="white" stroke="#e7e5e4" stroke-width="1"/>
    <g transform="translate(200,130)" text-anchor="middle">
      <circle cx="0" cy="-24" r="26" fill="#292524"/>
      <text y="-15" font-family="Inter" font-size="20" fill="white">📦</text>
      <text y="20" font-family="Inter" font-size="15" fill="#44403c" font-weight="600">${text}</text>
      <text y="42" font-family="Inter" font-size="11" fill="#78716c">Demo evidence photo</text>
    </g>
    <g transform="translate(30,258)">
      <rect width="96" height="18" rx="9" fill="#ecfdf5"/>
      <text x="10" y="12" font-family="Inter" font-size="9" fill="#047857" font-weight="600">LM-PC-2011 • DEMO</text>
    </g>
  </svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
