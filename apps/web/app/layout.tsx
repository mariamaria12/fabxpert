import type { Metadata, Viewport } from 'next';
import { THEME_COLORS } from '@fabxpert/shared';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text-primary">
        <ApiClientBootstrap />
        {children}
      </body>
    </html>
  );
}
