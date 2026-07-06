import type { Metadata } from 'next';

import '@fabxpert/shared/styles/tokens.css';
import './globals.css';

import { ApiClientBootstrap } from './api-client-bootstrap';

export const metadata: Metadata = {
  title: 'FabXpert',
  description: 'ERP platform for steel fabrication companies',
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
