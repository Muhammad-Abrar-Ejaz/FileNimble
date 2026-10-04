import type { MetadataRoute } from 'next';
import { canonicalUrl, informationPaths, publicTools } from '@/lib/seo';
import { availableFormats } from '@/config/formats';

export default function sitemap(): MetadataRoute.Sitemap {
  // Do not invent a lastModified date at request/build time.
  const paths = ['/', ...informationPaths, ...availableFormats().map(format => `/formats/${format}`), ...publicTools().map(tool => `/${tool.slug}`)];
  return [...new Set(paths)].map(path => ({ url: canonicalUrl(path) }));
}
