import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // @fabxpert/shared ships TypeScript source (exports ./src/index.ts).
  transpilePackages: ['@fabxpert/shared'],
};

export default nextConfig;
