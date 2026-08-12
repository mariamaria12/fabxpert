import type { Metadata, Viewport } from 'next';

import '@fabxpert/shared/styles/tokens.css';
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import './globals.css';

import { ApiClientBootstrap } from './api-client-bootstrap';

export const metadata: Metadata = {
  title: 'FabXpert Admin',
  description: 'Administrare & rapoarte',
};

export const viewport: Viewport = {
  // Matches --color-bg from packages/shared/styles/tokens.css.
  themeColor: '#1F1E19',
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
