import type { MetadataRoute } from 'next';

/** Installed on a phone the admin app is its own tile, next to FabXpert Time. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FabXpert Admin',
    short_name: 'FabXpert Admin',
    description: 'Administrare & rapoarte',
    lang: 'ro',
    start_url: '/',
    display: 'standalone',
    // Matches --color-bg from packages/shared/styles/tokens.css.
    theme_color: '#1F1E19',
    background_color: '#1F1E19',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
