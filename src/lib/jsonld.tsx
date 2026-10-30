// lib/jsonld.tsx — JSON-LD builders for FileNimble (Next.js App Router)
// Adapt the `Tool` type to your real registry. Planned tools return null: never mark them up.

import { TOOLS_BY_SLUG } from '@/config/tools';
import { PDF_TOOL_PAGES } from '@/config/pdfTools';
import { MEDIA_TOOLS } from '@/config/mediaTools';
import { DATA_TOOLS } from '@/config/dataTools';
import { IMAGE_TOOLS } from '@/config/imageTools';

const ORIGIN = 'https://www.filenimble.app';
const url = (path = '/') => (path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`);

const ID = {
  org: `${ORIGIN}/#organization`,
  site: `${ORIGIN}/#website`,
  logo: `${ORIGIN}/#logo`,
};

export type Tool = {
  slug: string;                       // e.g. 'merge-pdf'
  title: string;                      // visible H1, e.g. 'Merge PDF Files'
  metaTitle: string;                  // <title>, e.g. 'Merge PDF Files | FileNimble'
  description: string;                // the page's meta description
  appDescription?: string;            // distinct description for WebApplication node
  status: 'browser' | 'server' | 'planned';
  features: string[];                 // visible limits and capabilities
  steps?: (string | { name?: string; text: string })[]; // visible "How to use" steps
  faqs?: { q: string; a: string }[];  // visible FAQ, verbatim
};

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so page text can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

const organization = () => ({
  '@type': 'Organization',
  '@id': ID.org,
  name: 'FileNimble',
  url: url(),
  logo: {
    '@type': 'ImageObject',
    '@id': ID.logo,
    url: `${ORIGIN}/brand/filenimble-logo.png`,
    contentUrl: `${ORIGIN}/brand/filenimble-logo.png`,
    caption: 'FileNimble logo',
  },
  image: { '@id': ID.logo },
  description:
    'FileNimble offers free online file tools. Most tools run in your browser; TAR to ZIP and ZIP to TAR use temporary server processing.',
  email: 'filenimblesupport@gmail.com',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'filenimblesupport@gmail.com',
    url: url('/contact'),
    availableLanguage: 'English',
  },
});

const website = () => ({
  '@type': 'WebSite',
  '@id': ID.site,
  url: url(),
  name: 'FileNimble',
  description:
    'Free online file tools for PDFs, images and archives, with the processing location labelled on every tool.',
  inLanguage: 'en',
  publisher: { '@id': ID.org },
});

const breadcrumb = (path: string, crumbs: { name: string; path: string }[]) => ({
  '@type': 'BreadcrumbList',
  '@id': `${url(path)}#breadcrumb`,
  itemListElement: crumbs.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: url(c.path),
  })),
});

const home = { name: 'Home', path: '/' };

/** Homepage: Organization + WebSite + WebPage + ItemList of live tools only. */
export function homeGraph(liveTools: Tool[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization(),
      website(),
      {
        '@type': 'WebPage',
        '@id': `${url()}#webpage`,
        url: url(),
        name: 'FileNimble — Any file. Right format.',
        description:
          'Use browser-based file tools or convert TAR to ZIP and ZIP to TAR with temporary server processing. Planned tools are not available in this release.',
        inLanguage: 'en',
        isPartOf: { '@id': ID.site },
        about: { '@id': ID.org },
        primaryImageOfPage: { '@id': ID.logo },
        mainEntity: { '@id': `${url()}#featured-tools` },
      },
      {
        '@type': 'ItemList',
        '@id': `${url()}#featured-tools`,
        name: 'Featured FileNimble tools',
        itemListOrder: 'https://schema.org/ItemListUnordered',
        numberOfItems: liveTools.length,
        itemListElement: liveTools.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.title,
          url: url(`/${t.slug}`),
        })),
      },
    ],
  };
}

/** Tool page: WebPage + BreadcrumbList + WebApplication (+ FAQPage, HowTo when visible). */
export function toolGraph(tool: Tool | null | undefined) {
  if (!tool || tool.status === 'planned') return null; // no markup for unavailable tools

  const path = `/${tool.slug}`;
  const page = `${url(path)}#webpage`;
  const app = `${url(path)}#app`;

  const graph: object[] = [
    {
      '@type': 'WebPage',
      '@id': page,
      url: url(path),
      name: tool.metaTitle,
      description: tool.description,
      inLanguage: 'en',
      isPartOf: { '@id': ID.site },
      breadcrumb: { '@id': `${url(path)}#breadcrumb` },
      mainEntity: { '@id': app },
    },
    breadcrumb(path, [home, { name: 'Tools', path: '/tools' }, { name: tool.title, path }]),
    {
      '@type': 'WebApplication',
      '@id': app,
      name: tool.title,
      url: url(path),
      description: tool.appDescription || tool.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: tool.features,
      publisher: { '@id': ID.org },
    },
  ];

  if (tool.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url(path)}#faq`,
      isPartOf: { '@id': page },
      mainEntity: tool.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  if (tool.steps?.length) {
    graph.push({
      '@type': 'HowTo',
      '@id': `${url(path)}#howto`,
      name: `How to use ${tool.title}`,
      step: tool.steps.map((s, i) => {
        const isObj = typeof s === 'object' && s !== null;
        const text = isObj ? s.text : s;
        const name = isObj ? s.name : undefined;
        return {
          '@type': 'HowToStep',
          position: i + 1,
          ...(name ? { name } : {}),
          text,
        };
      }),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

/** About, Contact, Privacy, Terms, Formats and the /tools directory. */
export function pageGraph(opts: {
  path: string;
  type: 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'WebPage';
  name: string;          // the page's <title>
  description: string;   // the page's meta description
  crumbLabel: string;    // visible breadcrumb label
  items?: { name: string; path: string }[]; // CollectionPage only
}) {
  const { path, type, name, description, crumbLabel, items } = opts;
  const crumbs =
    path === '/tools'
      ? [home, { name: 'Tools', path }]
      : [home, { name: crumbLabel, path }];

  const graph: object[] = [
    {
      '@type': type,
      '@id': `${url(path)}#webpage`,
      url: url(path),
      name,
      description,
      inLanguage: 'en',
      isPartOf: { '@id': ID.site },
      ...(type === 'AboutPage' || type === 'ContactPage' ? { about: { '@id': ID.org } } : {}),
      breadcrumb: { '@id': `${url(path)}#breadcrumb` },
      ...(items ? { mainEntity: { '@id': `${url(path)}#list` } } : {}),
    },
    breadcrumb(path, crumbs),
  ];

  if (items) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${url(path)}#list`,
      name: 'Available FileNimble tools',
      itemListOrder: 'https://schema.org/ItemListUnordered',
      itemListElement: items.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t.name,
        url: url(t.path),
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

/** Map each tool in the registry to status 'browser', 'server', or 'planned'. */
export function getToolStatus(slug: string): 'browser' | 'server' | 'planned' {
  const tool = TOOLS_BY_SLUG.get(slug);
  if (!tool || tool.status !== 'live') return 'planned';
  if (slug === 'tar-to-zip' || slug === 'zip-to-tar') return 'server';
  return 'browser';
}

function getPdfFeatures(slug: string): string[] {
  switch (slug) {
    case 'merge-pdf':
      return [
        'Merge 2–10 PDF files in the order shown',
        'Keeps original page sizes, crop boxes and rotations',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 50 MiB and 200 pages in total',
      ];
    case 'split-pdf':
      return [
        'Split one PDF into individual pages or custom page groups',
        'Keeps original page sizes, crop boxes and rotations',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 100 output files and 200 pages in total',
      ];
    case 'extract-pdf-pages':
      return [
        'Extract selected pages or custom page ranges into a new PDF',
        'Keeps original page sizes, crop boxes and rotations',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 200 pages in total',
      ];
    case 'delete-pdf-pages':
      return [
        'Remove unwanted pages while keeping the rest in order',
        'Keeps original page sizes, crop boxes and rotations',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 200 pages in total',
      ];
    case 'organize-pdf':
      return [
        'Reorder PDF pages with move up and move down controls',
        'Keeps original page sizes, crop boxes and rotations',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 200 pages in total',
      ];
    case 'rotate-pdf':
      return [
        'Rotate selected PDF pages by 90, 180 or 270 degrees clockwise',
        'Changes page rotation without converting text to images',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 200 pages in total',
      ];
    case 'watermark-pdf':
      return [
        'Place a centered text watermark on every PDF page',
        'Adjust opacity and label drafts without uploading files',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 200 pages, 80 characters',
      ];
    case 'page-numbers-pdf':
      return [
        'Add sequential page numbers at top or bottom center',
        'Custom starting number with crop-box alignment',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 200 pages in total',
      ];
    case 'pdf-to-jpg':
      return [
        'Render selected PDF pages as real JPEG images at 72 or 144 DPI',
        'Set JPEG quality and download individual images or a local ZIP',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB upload, 40 selected pages, 8 MP per page, 64 MP total',
      ];
    case 'pdf-to-png':
      return [
        'Render selected PDF pages as crisp PNG images at 72 or 144 DPI',
        'Download individual images or a local ZIP without uploading files',
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB upload, 40 selected pages, 8 MP per page, 64 MP total',
      ];
    default:
      return [
        'Runs in the browser; PDF content is not uploaded',
        'Limits: 25 MiB per file, 200 pages in total',
      ];
  }
}

/** Retrieve typed tool structured data for JSON-LD generator. */
export function getToolJsonLd(slug: string): Tool | null {
  const toolRecord = TOOLS_BY_SLUG.get(slug);
  if (!toolRecord) return null;
  const status = getToolStatus(slug);
  if (status === 'planned') {
    return {
      slug,
      title: toolRecord.title || slug,
      metaTitle: toolRecord.seoTitle || `${toolRecord.title || slug} — Planned | FileNimble`,
      description: toolRecord.seoDescription || 'This tool is not available yet.',
      status: 'planned',
      features: [],
    };
  }

  // 1. PDF tools
  const pdfTool = PDF_TOOL_PAGES.find((p) => p.slug === slug);
  if (pdfTool) {
    return {
      slug,
      title: pdfTool.title,
      metaTitle: `${pdfTool.title} | FileNimble`,
      description: pdfTool.description,
      appDescription:
        slug === 'merge-pdf'
          ? 'Combine 2–10 PDFs into one document in your chosen order. Page sizes are preserved and files are processed in your browser, not uploaded to FileNimble.'
          : undefined,
      status: 'browser',
      features: getPdfFeatures(slug),
      steps:
        slug === 'merge-pdf'
          ? [
              { name: 'Choose files', text: 'Choose two to ten PDF documents, up to 50 MiB altogether.' },
              { name: 'Set the order', text: 'Use Move up and Move down beside the files to set document order, then read their pages.' },
              { name: 'Download', text: 'Create the merged PDF and download the combined document.' },
            ]
          : pdfTool.steps,
      faqs: pdfTool.faqs,
    };
  }

  // 2. Archive server tools
  const mediaTool = MEDIA_TOOLS.find((m) => m.slug === slug);
  if (mediaTool) {
    return {
      slug,
      title: mediaTool.title,
      metaTitle: `${mediaTool.title} | FileNimble`,
      description: mediaTool.description,
      appDescription:
        slug === 'tar-to-zip'
          ? 'Convert an ordinary uncompressed TAR archive to a validated ZIP. The file is uploaded to temporary server storage only when you choose Upload and convert; uploads expire after one hour.'
          : slug === 'zip-to-tar'
          ? 'Convert a supported ZIP archive into an uncompressed TAR. The file is uploaded to temporary server storage only when you choose Upload and convert; uploads expire after one hour.'
          : undefined,
      status: 'server',
      features:
        slug === 'tar-to-zip'
          ? [
              'Converts uncompressed USTAR-compatible .tar archives to stored .zip',
              'Preserves accepted file contents and relative paths',
              'Temporary server processing in isolated workers; outputs expire one hour after completion',
              'Limits: 10 MiB upload, 100 entries, 8 MiB per file, 24 MiB expanded total',
            ]
          : slug === 'zip-to-tar'
          ? [
              'Converts supported stored or deflated .zip archives to regular .tar',
              'Preserves accepted file contents and relative paths',
              'Temporary server processing in isolated workers; outputs expire one hour after completion',
              'Limits: 10 MiB upload, 100 entries, 8 MiB per file, 24 MiB expanded total',
            ]
          : [
              mediaTool.description,
              'Temporary server processing in isolated workers; outputs expire one hour after completion',
              mediaTool.processingLimits || 'Limits apply as stated on the tool page',
            ],
      steps: mediaTool.steps,
      faqs: mediaTool.faqs,
    };
  }

  // 3. Data tools
  const dataTool = DATA_TOOLS.find((d) => d.slug === slug);
  if (dataTool) {
    return {
      slug,
      title: dataTool.title,
      metaTitle: `${dataTool.title} | FileNimble`,
      description: dataTool.description,
      status: 'browser',
      features: [
        `Transform ${dataTool.inputFormat.toUpperCase()} into ${dataTool.outputFormat.toUpperCase()} in your browser`,
        'Runs in the browser; data is not uploaded to FileNimble',
        dataTool.limitations.split('. ')[0],
      ],
      steps: dataTool.steps,
      faqs: dataTool.faqs,
    };
  }

  // 4. Image tools
  const imageTool = IMAGE_TOOLS.find((img) => img.slug === slug);
  if (imageTool) {
    return {
      slug,
      title: imageTool.title,
      metaTitle: toolRecord.seoTitle || `${imageTool.title} | FileNimble`,
      description: toolRecord.seoDescription || imageTool.description,
      status: 'browser',
      features: imageTool.features,
      steps: imageTool.steps,
      faqs: imageTool.faqs,
    };
  }

  return null;
}

export const FEATURED_TOOL_SLUGS = [
  'merge-pdf',
  'split-pdf',
  'extract-pdf-pages',
  'delete-pdf-pages',
  'organize-pdf',
  'rotate-pdf',
  'watermark-pdf',
];

export function getFeaturedToolsJsonLd(): Tool[] {
  return FEATURED_TOOL_SLUGS.map((slug) => getToolJsonLd(slug)!).filter(Boolean);
}
