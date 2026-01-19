/** @type {import('next').NextConfig} */
// Cache invalidation: 2026-01-17 - Force Railway rebuild
// Force build: 2026-01-17-v1
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/v2-pilot',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
      {
        source: '/v2-pilot/',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;