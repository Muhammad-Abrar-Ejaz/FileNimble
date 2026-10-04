import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  serializeCsv,
  csvToJson,
  jsonToCsv,
  detectDelimiter,
  escapeCsvCell,
} from './csv';
import { jsonToYaml, yamlToJson } from './yaml';
import { jsonToXml, xmlToJson, validateXmlSecurity } from './xml';
import { markdownToHtml, htmlToMarkdown } from './markdown';

describe('CSV Engine', () => {
  it('auto-detects delimiters correctly', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectDelimiter('a|b|c\n1|2|3')).toBe('|');
  });

  it('parses standard RFC 4180 CSV with quotes and newlines in cells', () => {
    const csv = 'name,notes,score\n"Alice","Line 1\nLine 2",95\n"Bob, Jr.","Said ""Hello""",88';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(['name', 'notes', 'score']);
    expect(rows[1]).toEqual(['Alice', 'Line 1\nLine 2', '95']);
    expect(rows[2]).toEqual(['Bob, Jr.', 'Said "Hello"', '88']);
  });

  it('strips UTF-8 BOM correctly', () => {
    const csvWithBom = '\uFEFFcol1,col2\nval1,val2';
    const rows = parseCsv(csvWithBom);
    expect(rows[0][0]).toBe('col1');
  });

  it('serializes 2D array and records using serializeCsv', () => {
    const rawData = [
      ['Name', 'Score'],
      ['Alice', '95'],
    ];
    const out = serializeCsv(rawData);
    expect(out).toContain('Alice,95');
  });

  it('preserves Unicode and multilingual content', () => {
    const multilingual = 'language,sample\nJapanese,こんにちは\nArabic,مرحبا\nSpanish,¡Acción!\nMath,∑x²';
    const json = csvToJson(multilingual);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual([
      { language: 'Japanese', sample: 'こんにちは' },
      { language: 'Arabic', sample: 'مرحبا' },
      { language: 'Spanish', sample: '¡Acción!' },
      { language: 'Math', sample: '∑x²' },
    ]);
  });

  it('neutralizes spreadsheet formula injection prefixes (=, +, -, @, \\t, \\r)', () => {
    expect(escapeCsvCell('=SUM(A1:A10)')).toBe('\'=SUM(A1:A10)');
    expect(escapeCsvCell('=SUM(A1, B1)')).toBe('"\'=SUM(A1, B1)"');
    expect(escapeCsvCell('+12345')).toBe('\'\+12345');
    expect(escapeCsvCell('-cmd|/c calc')).toBe('\'\-cmd|/c calc');
    expect(escapeCsvCell('@SUM')).toBe('\'\@SUM');
    expect(escapeCsvCell('\tvalue')).toBe('\'\tvalue');
  });

  it('converts JSON array of objects to CSV with formula injection escaping', () => {
    const json = JSON.stringify([
      { name: 'Admin', payload: '=cmd|/C calc!A0' },
      { name: 'Normal', payload: 'Regular text' },
    ]);
    const csv = jsonToCsv(json);
    expect(csv).toContain('\'=cmd|/C calc!A0');
    expect(csv).toContain('Regular text');
  });

  it('flattens nested JSON objects safely up to maxDepth', () => {
    const json = JSON.stringify([
      { id: 1, user: { name: 'Alice', address: { city: 'Paris' } } },
    ]);
    const csv = jsonToCsv(json);
    expect(csv).toContain('user.name');
    expect(csv).toContain('user.address.city');
    expect(csv).toContain('Paris');
  });

  it('rejects malformed JSON syntax gracefully', () => {
    expect(() => jsonToCsv('{ not valid json }')).toThrow(/Invalid JSON syntax/);
  });
});

describe('YAML Engine', () => {
  it('converts JSON to formatted YAML and back accurately', () => {
    const originalJson = JSON.stringify({
      app: 'FileNimble',
      version: '0.1.0',
      active: true,
      tags: ['convert', 'secure', 'fast'],
      nested: { key: 'value', number: 42 },
    });

    const yaml = jsonToYaml(originalJson);
    expect(yaml).toContain('app: FileNimble');
    expect(yaml).toContain('tags:');

    const roundtripJson = yamlToJson(yaml);
    expect(JSON.parse(roundtripJson)).toEqual(JSON.parse(originalJson));
  });

  it('rejects deeply nested YAML to prevent stack exhaustion', () => {
    let deepYaml = 'item:\n';
    for (let i = 0; i < 30; i++) {
      deepYaml += '  '.repeat(i + 1) + 'child:\n';
    }
    deepYaml += '  '.repeat(31) + 'leaf: 1\n';

    expect(() => yamlToJson(deepYaml)).toThrow(/maximum nesting depth limit/);
  });

  it('rejects malformed YAML gracefully', () => {
    expect(() => yamlToJson('key: [unclosed array')).toThrow(/Invalid YAML syntax/);
  });
});

describe('XML Engine', () => {
  it('converts JSON to XML and back preserving structure', () => {
    const json = JSON.stringify({
      user: {
        name: 'Alice',
        role: 'Engineer',
        scores: [90, 85, 92],
      },
    });

    const xml = jsonToXml(json);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<name>Alice</name>');

    const parsedJson = xmlToJson(xml);
    const roundtrip = JSON.parse(parsedJson);
    expect(roundtrip.user.name).toBe('Alice');
    expect(roundtrip.user.role).toBe('Engineer');
  });

  it('strictly rejects XXE attacks and external DTDs', () => {
    const xxePayload = `<?xml version="1.0"?>
    <!DOCTYPE foo [
      <!ELEMENT foo ANY >
      <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
    <foo>&xxe;</foo>`;

    expect(() => validateXmlSecurity(xxePayload)).toThrow(/External entity resolution/);
    expect(() => xmlToJson(xxePayload)).toThrow(/External entity resolution/);
  });

  it('strictly rejects entity expansion bombs (Billion Laughs)', () => {
    const bombPayload = `<?xml version="1.0"?>
    <!DOCTYPE lolz [
      <!ENTITY lol "lol">
      <!ENTITY lol1 "&lol;&lol;">
      <!ENTITY lol2 "&lol1;&lol1;">
      <!ENTITY lol3 "&lol2;&lol2;">
      <!ENTITY lol4 "&lol3;&lol3;">
      <!ENTITY lol5 "&lol4;&lol4;">
      <!ENTITY lol6 "&lol5;&lol5;">
    ]>
    <lolz>&lol6;</lolz>`;

    expect(() => validateXmlSecurity(bombPayload)).toThrow(/Entity expansion bomb detected/);
    expect(() => xmlToJson(bombPayload)).toThrow(/Entity expansion bomb detected/);
  });

  it('rejects empty or malformed XML', () => {
    expect(() => xmlToJson('')).toThrow();
    expect(() => xmlToJson('<unclosed>tag')).toThrow();
  });
});

describe('Markdown Engine', () => {
  it('converts Markdown to HTML with GFM tables and code blocks', async () => {
    const md = `# Document Title

This is a paragraph with **bold** and *italic* text.

| Column A | Column B |
|---|---|
| Value 1 | Value 2 |

\`\`\`javascript
const x = 42;
\`\`\`
`;
    const html = await markdownToHtml(md, { fullDocument: true, title: 'My Page' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<h1>Document Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<table>');
    expect(html).toContain('<pre><code class="language-javascript">const x = 42;');
  });

  it('sanitizes hostile script tags and event handlers from Markdown HTML output', async () => {
    const hostileMd = `# Title
<script>alert('xss')</script>
<img src="x" onerror="alert(1)">
<a href="javascript:alert(2)">Click me</a>
`;
    const html = await markdownToHtml(hostileMd);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(\'xss\')');
    expect(html).not.toContain('onerror=');
    expect(html).not.toContain('javascript:alert');
  });

  it('converts HTML to Markdown accurately', () => {
    const html = `<h2>Section Heading</h2>
<p>Here is a paragraph with <strong>bold</strong> and <em>italic</em> words.</p>
<ul>
  <li>First item</li>
  <li>Second item</li>
</ul>
<pre><code>console.log('hello');</code></pre>`;

    const md = htmlToMarkdown(html);
    expect(md).toContain('## Section Heading');
    expect(md).toContain('**bold**');
    expect(md).toContain('*italic*');
    expect(md).toContain('First item');
    expect(md).toContain('Second item');
    expect(md).toContain("console.log('hello');");
  });
});
