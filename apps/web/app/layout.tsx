import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { THEME_COLORS } from '@fabxpert/shared';
import { THEME_STORAGE_KEY } from '@/utils/theme';

import '@fabxpert/shared/styles/tokens.css';
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import './globals.css';

import { ApiClientBootstrap } from './api-client-bootstrap';

export const metadata: Metadata = {
  title: 'FabXpert Admin',
  description: 'Administrare & rapoarte',
};

export const viewport: Viewport = {
  themeColor: THEME_COLORS.bg,
};

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

// Runs before paint so a stored theme never flashes another one. Mirrors
// readStoredTheme() in utils/theme.ts; 'dark' is the bare :root palette.
const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t&&t!=='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="bg-bg text-text-primary">
        <ApiClientBootstrap />
        {children}
      </body>
    </html>
  );
}
