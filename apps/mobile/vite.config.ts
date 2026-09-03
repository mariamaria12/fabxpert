import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// Relative import: the @fabxpert/shared alias below only applies to app code, not to this config.
import { THEME_COLORS } from '../../packages/shared/src/themeColors';

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@fabxpert\/shared$/,
        replacement: path.resolve(appDir, '../../packages/shared/src/index.ts'),
      },
      {
        find: '@fabxpert/shared/leaveLabels',
        replacement: path.resolve(appDir, '../../packages/shared/src/leaveLabels.ts'),
      },
      {
        find: '@fabxpert/shared/leaveDays',
        replacement: path.resolve(appDir, '../../packages/shared/src/leaveDays.ts'),
      },
      {
        find: '@fabxpert/shared/workDate',
        replacement: path.resolve(appDir, '../../packages/shared/src/workDate.ts'),
      },
    ],
  },
  plugins: [
    react(),
    {
      // index.html cannot import the palette, so the theme-color meta is filled in here.
      name: 'theme-color-meta',
      transformIndexHtml: (html) => html.replaceAll('{{THEME_COLOR}}', THEME_COLORS.goldBg),
    },
    VitePWA({
      // Default generated service worker: precaches built assets, auto-updates.
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        // Push/notificationclick handlers live in public/push-sw.js so the
        // generated service worker stays untouched.
        importScripts: ['/push-sw.js'],
      },
      manifest: {
        name: 'FabXpert Time',
        short_name: 'FabXpert Time',
        description: 'Pontaj muncitori',
        lang: 'ro',
        theme_color: THEME_COLORS.goldBg,
        background_color: THEME_COLORS.goldBg,
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
    proxy: {
      // Same-origin /api in dev — mirrors Vercel rewrite so auth cookies work on mobile.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
