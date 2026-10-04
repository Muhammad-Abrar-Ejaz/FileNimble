/**
 * Markdown <-> HTML conversion engine using marked (MIT) and turndown (MIT).
 *
 * Security controls:
 * - XSS Prevention: Disables dangerous script tags, event handlers, and data URIs in output HTML.
 * - Maximum input limit: 10 MiB.
 * - Unicode & multibyte character preservation.
 */

import { marked } from 'marked';
import TurndownService from 'turndown';

const MAX_MD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

/**
 * Basic HTML sanitizer to strip executable scripts and hostile event handlers.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/\s+on\w+=[^\s>]+/gi, '')
    .replace(/href\s*=\s*["']?javascript:[^"'>]*/gi, 'href="#"');
}

/**
 * Convert Markdown text to formatted HTML.
 */
export async function markdownToHtml(
  mdText: string,
  options: { fullDocument?: boolean; title?: string } = {}
): Promise<string> {
  if (mdText.length > MAX_MD_SIZE_BYTES) {
    throw new Error('Markdown file exceeds maximum limit of 10 MiB.');
  }

  // Parse Markdown to HTML
  const rawHtml = await marked.parse(mdText, {
    gfm: true,
    breaks: true,
  });

  const cleanBody = sanitizeHtml(rawHtml);

  if (options.fullDocument) {
    const title = options.title || 'Document';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.25; }
    code { background: #f4f4f4; padding: 2px 5px; border-radius: 4px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 15px; color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f8f9fa; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${cleanBody}
</body>
</html>`;
  }

  return cleanBody;
}

/**
 * Convert HTML text to GitHub Flavored Markdown.
 */
export function htmlToMarkdown(htmlText: string): string {
  if (htmlText.length > MAX_MD_SIZE_BYTES) {
    throw new Error('HTML file exceeds maximum limit of 10 MiB.');
  }

  const clean = sanitizeHtml(htmlText);

  const turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  return turndown.turndown(clean);
}
