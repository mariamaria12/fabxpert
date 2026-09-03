import type { MetadataRoute } from 'next';
import { THEME_COLORS } from '@fabxpert/shared';

/** Installed on a phone the admin app is its own tile, next to FabXpert Time. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FabXpert Admin',
    short_name: 'FabXpert Admin',
    description: 'Administrare & rapoarte',
    lang: 'ro',
    start_url: '/',
    display: 'standalone',
    theme_color: THEME_COLORS.bg,
    background_color: THEME_COLORS.bg,
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
