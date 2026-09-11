import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Salmon Pay',
    short_name: 'Salmon Pay',
    description: 'Universal USDC payment requests for humans and agents on Solana.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#F7F8FA',
    theme_color: '#FF5C45',
    categories: ['finance', 'business', 'utilities'],
    icons: [
      { src: '/icons/192/eEVdT.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512/eEVdT.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    shortcuts: [
      {
        name: 'Create payment request',
        short_name: 'New payment',
        url: '/#top',
        icons: [{ src: '/icons/192/eEVdT.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
