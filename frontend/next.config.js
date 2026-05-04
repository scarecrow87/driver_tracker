const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true',
  register: true,
  skipWaiting: true,
  customWorkerDir: 'worker',
});

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: process.env.NEXT_USE_WORKER_THREADS === 'true' ? { workerThreads: true } : undefined,
  eslint: {
    ignoreDuringBuilds: process.env.DISABLE_NEXT_BUILD_LINT === 'true',
  },
  typescript: {
    ignoreBuildErrors: process.env.DISABLE_NEXT_BUILD_TYPECHECK === 'true',
  },
  env: {
    API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];

    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
