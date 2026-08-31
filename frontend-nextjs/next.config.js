/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'http', hostname: 'localhost', port: '5000', pathname: '/uploads/**' }],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:5000/api/:path*' },
    ];
  },
};
module.exports = nextConfig;
