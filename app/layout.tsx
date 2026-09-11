import type { Metadata, Viewport } from 'next';
import { DM_Mono, DM_Sans } from 'next/font/google';
import './globals.css';
import { PwaRegister } from './pwa-register';
const sans = DM_Sans({ variable: '--font-sans', subsets: ['latin'] });
const mono = DM_Mono({ variable: '--font-mono', subsets: ['latin'], weight: ['400', '500'] });
const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001');
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'Salmon Pay — One payment. Any caller.',
  description: 'Universal USDC payment requests for humans and agents on Solana.',
  applicationName: 'Salmon Pay',
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Salmon Pay',
    title: 'Salmon Pay — One payment. Any caller.',
    description: 'Universal USDC payment requests for humans and agents on Solana.',
    images: [
      { url: '/og.png', width: 1200, height: 630, alt: 'Salmon Pay — One payment. Any caller.' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Salmon Pay — One payment. Any caller.',
    description: 'Universal USDC payment requests for humans and agents on Solana.',
    images: ['/og.png'],
  },
};
export const viewport: Viewport = { themeColor: '#FF5C45' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
