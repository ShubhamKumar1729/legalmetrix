/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["mongoose"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // DENY in production (anti click-jacking); SAMEORIGIN elsewhere so
          // dev/preview environments can embed the app in iframes.
          { key: "X-Frame-Options", value: isProd ? "DENY" : "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
