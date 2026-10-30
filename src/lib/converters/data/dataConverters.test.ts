import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  serializeCsv,
  csvToJson,
  jsonToCsv,
  detectDelimiter,
  escapeCsvCell,
  csvToTsv,
  tsvToCsv,
  htmlTableToCsv,
} from './csv';
import { jsonToYaml, yamlToJson } from './yaml';
import { jsonToXml, xmlToJson, validateXmlSecurity, xmlToCsv } from './xml';
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

  describe('TSV and Tabular Converters', () => {
    it('converts CSV to TSV accurately with tab delimiters', () => {
      const csv = 'name,role,department\nAlice,Engineer,Core\nBob,Designer,Product';
      const tsv = csvToTsv(csv, { newline: '\n' });
      expect(tsv).toBe('name\trole\tdepartment\nAlice\tEngineer\tCore\nBob\tDesigner\tProduct');
    });

    it('sanitizes embedded tabs and newlines inside CSV cells when exporting to TSV', () => {
      const csv = 'item,description\nA,"has\tembedded\ttab"\nB,"line 1\nline 2"';
      const tsv = csvToTsv(csv, { newline: '\n' });
      expect(tsv).toContain('A\thas embedded tab');
      expect(tsv).toContain('B\tline 1 line 2');
    });

    it('converts TSV to CSV with formula injection defense and quoting', () => {
      const tsv = 'name\tformula\tcity\nAlice\t=SUM(1,2)\tNew York, NY\nBob\t+12345\tSeattle';
      const csv = tsvToCsv(tsv, { newline: '\n' });
      expect(csv).toContain('Alice,"\'=SUM(1,2)","New York, NY"');
      expect(csv).toContain('Bob,\'+12345,Seattle');
    });

    it('extracts structured HTML tables to RFC 4180 CSV', () => {
      const html = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Laptop</strong></td>
              <td>$999.00</td>
              <td>15</td>
            </tr>
            <tr>
              <td>Mouse, Wireless</td>
              <td>=25+5</td>
              <td>50</td>
            </tr>
          </tbody>
        </table>
      `;
      const csv = htmlTableToCsv(html, { newline: '\n' });
      expect(csv).toContain('Product,Price,Stock');
      expect(csv).toContain('Laptop,$999.00,15');
      expect(csv).toContain('"Mouse, Wireless",\'=25+5,50');
    });

    it('throws descriptive error if HTML has no <table>', () => {
      expect(() => htmlTableToCsv('<p>No table here</p>')).toThrow(/No <table> element found/);
    });

    it('converts XML records to CSV with attributes and children as columns', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <employees>
          <employee id="e1">
            <name>Alice Smith</name>
            <department>Engineering</department>
            <salary>95000</salary>
          </employee>
          <employee id="e2">
            <name>Bob Jones</name>
            <department>Marketing, Sales</department>
            <salary>=1000*80</salary>
          </employee>
        </employees>
      `;
      const csv = xmlToCsv(xml, { newline: '\n' });
      expect(csv).toContain('name,department,salary,id');
      expect(csv).toContain('Alice Smith,Engineering,95000,e1');
      expect(csv).toContain('Bob Jones,"Marketing, Sales",\'=1000*80,e2');
    });

    it('blocks hostile XXE attacks during XML to CSV conversion', () => {
      const hostileXml = `<?xml version="1.0"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <root><data>&xxe;</data></root>
      `;
      expect(() => xmlToCsv(hostileXml)).toThrow(/External entity resolution/);
    });
  });
});
