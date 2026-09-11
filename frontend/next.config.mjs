/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/api/dock/:path*',
        destination: 'http://127.0.0.1:8000/api/dock/:path*',
      },
      {
        source: '/api/robot/:path*',
        destination: 'http://127.0.0.1:8000/api/robot/:path*',
      },
      {
        source: '/api/vision/:path*',
        destination: 'http://127.0.0.1:8000/api/vision/:path*',
      },
      {
        source: '/api/status',
        destination: 'http://127.0.0.1:8000/api/status',
      },
      {
        source: '/api/analytics',
        destination: 'http://127.0.0.1:8000/api/analytics',
      },
      {
        source: '/api/runs',
        destination: 'http://127.0.0.1:8000/api/runs',
      },
    ];
  },
};

export default nextConfig;
