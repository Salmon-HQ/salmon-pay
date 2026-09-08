import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap{const origin=process.env.NEXT_PUBLIC_APP_URL??'http://localhost:3001';return [{url:new URL('/',origin).toString(),changeFrequency:'weekly',priority:1},{url:new URL('/docs',origin).toString(),changeFrequency:'monthly',priority:.7}]}
