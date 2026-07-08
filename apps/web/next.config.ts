import type { NextConfig } from 'next';

function apiRewriteDestination(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw || raw.startsWith('/')) {
    return null;
  }
  let base = raw.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  try {
    // Validate URL shape before wiring rewrites.
    new URL(base);
  } catch {
    return null;
  }
  return base;
}

const nextConfig: NextConfig = {
  devIndicators: false,
  // @fabxpert/shared ships TypeScript source (exports ./src/index.ts).
  transpilePackages: ['@fabxpert/shared'],
  async rewrites() {
    const upstream = apiRewriteDestination();
    if (!upstream) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${upstream}/:path*`,
      },
    ];
  },
  async redirects() {
    // Legacy Romanian URLs → English routes (sidebar uses English paths).
    return [
      { source: '/proiecte', destination: '/projects', permanent: true },
      { source: '/companii', destination: '/companies', permanent: true },
      { source: '/persoane', destination: '/people', permanent: true },
      { source: '/pontaje', destination: '/timesheets', permanent: true },
      { source: '/utilizatori', destination: '/admin', permanent: true },
      { source: '/users', destination: '/admin', permanent: true },
      { source: '/administrare', destination: '/admin', permanent: true },
    ];
  },
};

export default nextConfig;
