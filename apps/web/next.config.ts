import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // @fabxpert/shared ships TypeScript source (exports ./src/index.ts).
  transpilePackages: ['@fabxpert/shared'],
  async redirects() {
    // Legacy Romanian URLs → English routes (sidebar uses English paths).
    return [
      { source: '/proiecte', destination: '/projects', permanent: true },
      { source: '/companii', destination: '/companies', permanent: true },
      { source: '/persoane', destination: '/people', permanent: true },
      { source: '/pontaje', destination: '/timesheets', permanent: true },
      { source: '/utilizatori', destination: '/users', permanent: true },
    ];
  },
};

export default nextConfig;
