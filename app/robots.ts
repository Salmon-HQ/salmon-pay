import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: new URL(
      '/sitemap.xml',
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
    ).toString(),
  };
}
