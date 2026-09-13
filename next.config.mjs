/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` and `next start` cannot share a build directory — they overwrite each
  // other's chunks and both then fail with MODULE_NOT_FOUND. Point the test/production
  // server at its own output with NEXT_DIST_DIR when running alongside a dev server.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  experimental: {
    serverComponentsExternalPackages: ["mongoose"],
  },
  images: {
    domains: ["localhost"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
