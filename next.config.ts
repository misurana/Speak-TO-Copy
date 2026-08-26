import type { NextConfig } from 'next'; const nextConfig: NextConfig = { async rewrites() { return [{ source: '/', destination: '/speak-to-copy.html' }]; } }; export default nextConfig;
