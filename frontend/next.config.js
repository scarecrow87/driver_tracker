const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  customWorkerDir: 'worker',
});

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = withPWA(nextConfig);
