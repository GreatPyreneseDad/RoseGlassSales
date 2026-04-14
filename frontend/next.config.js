/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const scoutLabUrl = process.env.NEXT_PUBLIC_SCOUT_LAB_URL || 'http://localhost:8001';
    return [
      {
        source: '/scout-lab/:path*',
        destination: `${scoutLabUrl}/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
