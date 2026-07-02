import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FabXpert',
  description: 'ERP platform for steel fabrication companies',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
