import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Default generated service worker: precaches built assets, auto-updates.
      registerType: 'autoUpdate',
      manifest: {
        name: 'FabXpert',
        short_name: 'FabXpert',
        // Matches --color-bg from packages/shared/styles/tokens.css.
        theme_color: '#1F1E19',
        background_color: '#1F1E19',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 3001,
  },
  preview: {
    port: 3001,
  },
});
