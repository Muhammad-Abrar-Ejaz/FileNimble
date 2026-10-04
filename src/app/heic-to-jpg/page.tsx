import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { getToolBySlug } from '@/lib/registry';
import { RelatedTools } from '@/components/tools/RelatedTools';

export const metadata: Metadata = {
  title: 'HEIC to JPG — Planned | FileNimble',
  description: 'HEIC conversion is under evaluation and is not available yet. Learn about browser compatibility and current alternatives.',
  alternates: { canonical: `${siteConfig.url}/heic-to-jpg` },
  robots: { index: false, follow: true },
};

export default function HeicToJpgPage() {
  const tool = getToolBySlug('heic-to-jpg');
  return <div className="mx-auto max-w-4xl space-y-8 px-4 py-12">
    <h1 className="text-3xl font-bold">HEIC to JPG — Planned</h1>
    <p>HEIC conversion is not available in FileNimble yet. This is an informational evaluation page; no files are selected, decoded, or uploaded here.</p>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Browser compatibility</h2>
      <p>Apple added HEIC image support in Safari 17. Browser and operating system differences still need testing with real photos before we can offer a dependable converter.</p>
      <a className="underline" href="https://webkit.org/blog/14445/webkit-features-in-safari-17-0/">WebKit Safari 17 release notes</a>
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">What can I do now?</h2>
      <p>Export your photo as JPEG or PNG using a compatible photo application, then use our image tools.</p>
      <Link className="underline" href="/jpg-to-png">Convert an exported JPG to PNG</Link>
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Why is this still planned?</h2>
      <p>We have not qualified a decoder across browsers, measured its memory requirements, or completed a review of its distribution terms. No server processing architecture or release date has been selected.</p>
    </section>
    {tool && <RelatedTools tool={tool} />}
  </div>;
}
