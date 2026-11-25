import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          destination: '/speak-to-copy.html',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
