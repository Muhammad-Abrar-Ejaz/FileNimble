export interface DataToolConfig {
  slug: string;
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  inputMime: string;
  outputMime: string;
  outputFilename: string;
  heading: string;
  explanation: string;
  limitations: string;
  steps: string[];
  faqs: { q: string; a: string }[];
  related: string[];
}

export const DATA_TOOLS: DataToolConfig[] = [
  {
    slug: 'csv-to-json',
    title: 'Convert CSV to JSON Online',
    description: 'Transform CSV and tabular data into clean, structured JSON in your browser with zero server uploads.',
    inputFormat: 'csv',
    outputFormat: 'json',
    inputMime: 'text/csv',
    outputMime: 'application/json',
    outputFilename: 'converted.json',
    heading: 'Instant, private CSV to JSON conversion',
    explanation: 'Parses standard comma, semicolon, tab, or pipe-separated CSV files into JSON arrays of objects. Automatically detects delimiters and preserves UTF-8 Unicode characters without uploading your data to any server.',
    limitations: 'Maximum file size: 10 MiB, up to 50,000 rows and 1,000 columns. Malformed CSV with unescaped quotes is rejected. UTF-8 character encoding is preferred.',
    steps: [
      'Select or drop your CSV file, or paste CSV text directly.',
      'Configure options such as delimiter auto-detection and data type coercion.',
      'Review the formatted JSON output and download or copy it instantly.'
    ],
    faqs: [
      { q: 'Is my CSV data uploaded to a server?', a: 'No. The conversion runs entirely inside your web browser using JavaScript. Your files never leave your computer.' },
      { q: 'How does it handle different delimiters?', a: 'The parser auto-detects standard delimiters (comma, semicolon, tab, pipe) or lets you select one explicitly.' },
      { q: 'Are numbers and booleans automatically parsed?', a: 'Yes. Numeric values, booleans (true/false), and nulls are converted to their native JSON types automatically.' }
    ],
    related: ['json-to-csv', 'csv-to-xlsx', 'json-to-yaml', 'json-to-xml']
  },
  {
    slug: 'json-to-csv',
    title: 'Convert JSON to CSV Online',
    description: 'Convert JSON arrays or objects into standard RFC 4180 CSV with built-in formula injection protection.',
    inputFormat: 'json',
    outputFormat: 'csv',
    inputMime: 'application/json',
    outputMime: 'text/csv',
    outputFilename: 'converted.csv',
    heading: 'Safe, private JSON to CSV conversion',
    explanation: 'Converts JSON arrays of objects or 2D arrays into standard spreadsheet-ready CSV format. Includes built-in spreadsheet formula injection prevention to protect against malicious payloads when opened in Excel or Google Sheets.',
    limitations: 'Maximum file size: 10 MiB. Maximum nesting depth of 5 levels is flattened automatically (e.g., user.address.city). Unsupported deeply recursive structures are rejected.',
    steps: [
      'Upload a JSON file or paste your JSON text.',
      'Review the auto-detected columns and formula injection safety toggle.',
      'Download your RFC 4180 compliant CSV file or copy the text.'
    ],
    faqs: [
      { q: 'How does formula injection protection work?', a: 'Cell values starting with dangerous formula prefixes (=, +, -, @, \\t, \\r) are automatically prefixed with a single quote (\') to prevent execution when opened in spreadsheet software.' },
      { q: 'How are nested objects handled?', a: 'Nested object keys are flattened using dot notation (for example, person.name), and arrays are represented as JSON strings.' },
      { q: 'Can I convert large JSON arrays?', a: 'Yes, up to 10 MiB of JSON data is safely processed in memory within your browser.' }
    ],
    related: ['csv-to-json', 'json-to-xlsx', 'json-to-yaml', 'json-to-xml']
  },
  {
    slug: 'json-to-yaml',
    title: 'Convert JSON to YAML Online',
    description: 'Convert JSON configuration files into clean, readable YAML with syntax validation and browser-side privacy.',
    inputFormat: 'json',
    outputFormat: 'yaml',
    inputMime: 'application/json',
    outputMime: 'text/yaml',
    outputFilename: 'converted.yaml',
    heading: 'Clean, formatted YAML from JSON in seconds',
    explanation: 'Transforms JSON data into standard YAML format using the mature, safe yaml library. Indentation, types, lists, and nested objects are preserved with complete precision.',
    limitations: 'Maximum file size: 10 MiB. Maximum nesting depth: 25 levels to prevent recursive memory attacks.',
    steps: [
      'Upload a JSON file or paste JSON code into the editor.',
      'Click convert to generate clean, readable 2-space indented YAML.',
      'Download the .yaml file or copy the output directly.'
    ],
    faqs: [
      { q: 'Does this converter execute arbitrary YAML code?', a: 'No. The conversion uses strict safe parsing and stringification with all custom tags and code execution disabled.' },
      { q: 'Is my configuration data kept private?', a: 'Yes. Processing occurs 100% inside your browser session. No data is sent over the network.' }
    ],
    related: ['yaml-to-json', 'json-to-xml', 'json-to-csv', 'csv-to-json']
  },
  {
    slug: 'yaml-to-json',
    title: 'Convert YAML to JSON Online',
    description: 'Convert YAML configurations, Kubernetes manifests, and Docker Compose files to JSON safely in your browser.',
    inputFormat: 'yaml',
    outputFormat: 'json',
    inputMime: 'text/yaml',
    outputMime: 'application/json',
    outputFilename: 'converted.json',
    heading: 'Safe YAML to JSON transformation',
    explanation: 'Parses YAML files safely into standard JSON format. Ideal for translating Kubernetes manifests, CI/CD pipelines, and configuration files into JSON for APIs and programmatic workflows.',
    limitations: 'Maximum file size: 10 MiB. Recursion depth capped at 25 levels. Custom unsafe YAML tags and object instantiations are disallowed.',
    steps: [
      'Upload a YAML file or paste YAML text.',
      'Click convert to produce formatted JSON output.',
      'Copy the JSON or download the result.'
    ],
    faqs: [
      { q: 'Are multiple YAML documents supported?', a: 'Standard single documents and multi-item lists are fully supported.' },
      { q: 'Can I format or minify the resulting JSON?', a: 'Yes. Output is neatly formatted with 2-space indentation by default for easy inspection.' }
    ],
    related: ['json-to-yaml', 'json-to-xml', 'json-to-csv', 'xml-to-json']
  },
  {
    slug: 'json-to-xml',
    title: 'Convert JSON to XML Online',
    description: 'Transform JSON data into well-formed XML documents with customizable root tags and browser privacy.',
    inputFormat: 'json',
    outputFormat: 'xml',
    inputMime: 'application/json',
    outputMime: 'application/xml',
    outputFilename: 'converted.xml',
    heading: 'Well-formed XML generation from JSON',
    explanation: 'Generates valid XML with XML declaration (<?xml version="1.0" encoding="UTF-8"?>), proper attribute formatting, and clean tag indentation from arbitrary JSON structures.',
    limitations: 'Maximum file size: 10 MiB. JSON keys must be valid XML tag names or will be normalized. Maximum nesting depth: 25 levels.',
    steps: [
      'Upload your JSON file or paste JSON text.',
      'Configure the root XML element name if desired.',
      'Download your well-formed XML file or copy it to clipboard.'
    ],
    faqs: [
      { q: 'What root element is used?', a: 'If your JSON does not have a single top-level key, elements are wrapped in a standard <root> container.' },
      { q: 'How are JSON arrays represented in XML?', a: 'Array elements are wrapped in repeated <item> child tags under their parent container.' }
    ],
    related: ['xml-to-json', 'json-to-yaml', 'json-to-csv', 'yaml-to-json']
  },
  {
    slug: 'xml-to-json',
    title: 'Convert XML to JSON Online',
    description: 'Convert XML documents to JSON with strict XXE protection and Billion Laughs defense in your browser.',
    inputFormat: 'xml',
    outputFormat: 'json',
    inputMime: 'application/xml',
    outputMime: 'application/json',
    outputFilename: 'converted.json',
    heading: 'Hardened, secure XML to JSON conversion',
    explanation: 'Parses XML documents into JSON objects while strictly blocking XML External Entity (XXE) attacks, external DTD fetching, and recursive entity expansion bombs.',
    limitations: 'Maximum file size: 10 MiB. External entity references (SYSTEM, PUBLIC, remote DTDs) are strictly blocked for security. Malformed XML tags will trigger an error.',
    steps: [
      'Select or drop your XML file, or paste XML text.',
      'Our security engine verifies that no external entities or expansion bombs exist.',
      'Inspect the converted JSON and download or copy the result.'
    ],
    faqs: [
      { q: 'How does FileNimble protect against XXE attacks?', a: 'Our parser disables all external entity resolution and actively inspects documents to reject any <!DOCTYPE or <!ENTITY declarations referencing external resources.' },
      { q: 'Are XML attributes preserved?', a: 'Yes. Attributes are parsed and stored with the standard @_ prefix in the JSON structure.' }
    ],
    related: ['json-to-xml', 'json-to-yaml', 'xml-to-csv', 'json-to-csv']
  },
  {
    slug: 'markdown-to-html',
    title: 'Convert Markdown to HTML Online',
    description: 'Convert GitHub Flavored Markdown (GFM) into clean HTML with table support and XSS sanitization.',
    inputFormat: 'md',
    outputFormat: 'html',
    inputMime: 'text/markdown',
    outputMime: 'text/html',
    outputFilename: 'document.html',
    heading: 'Instant, secure Markdown to HTML conversion',
    explanation: 'Renders Markdown text, headings, tables, task lists, code blocks, and blockquotes into clean, sanitized HTML. Includes automatic script and iframe neutralization to protect against XSS.',
    limitations: 'Maximum file size: 10 MiB. Executable JavaScript and hostile event handlers are stripped. Output can be saved as a complete standalone HTML document with responsive styling or as a body fragment.',
    steps: [
      'Upload a Markdown file (.md) or paste Markdown content.',
      'View the real-time HTML preview and source code.',
      'Download the self-contained HTML file or copy the HTML markup.'
    ],
    faqs: [
      { q: 'Is GitHub Flavored Markdown (GFM) supported?', a: 'Yes. Tables, strikethrough, autolinks, code blocks, and task lists are fully supported.' },
      { q: 'Does the output include styling?', a: 'You can choose to download a complete HTML5 document with clean, responsive typography or copy the raw HTML snippet.' }
    ],
    related: ['html-to-markdown', 'markdown-to-pdf', 'markdown-to-docx', 'docx-to-markdown']
  },
  {
    slug: 'html-to-markdown',
    title: 'Convert HTML to Markdown Online',
    description: 'Convert HTML documents and web snippets into clean, readable GitHub Flavored Markdown in your browser.',
    inputFormat: 'html',
    outputFormat: 'md',
    inputMime: 'text/html',
    outputMime: 'text/markdown',
    outputFilename: 'document.md',
    heading: 'Clean HTML to Markdown conversion',
    explanation: 'Converts HTML tags (headings, paragraphs, bold, italic, code blocks, blockquotes, lists, links) into clean Markdown syntax using the Turndown conversion engine.',
    limitations: 'Maximum file size: 10 MiB. Complex interactive elements (forms, canvas, scripts) are omitted. Standard document text and formatting are preserved.',
    steps: [
      'Upload an HTML file or paste HTML markup.',
      'The converter cleans up tags and produces standard Markdown syntax.',
      'Copy the Markdown text or download the .md file.'
    ],
    faqs: [
      { q: 'Can I paste HTML copied from websites or emails?', a: 'Yes. You can paste HTML snippets directly into the editor and convert them to clean Markdown immediately.' },
      { q: 'Are image tags and links preserved?', a: 'Yes. Standard image and anchor tags are converted to Markdown image and link syntax.' }
    ],
    related: ['markdown-to-html', 'markdown-to-pdf', 'markdown-to-docx', 'docx-to-markdown']
  }
];

export function getDataToolBySlug(slug: string): DataToolConfig | undefined {
  return DATA_TOOLS.find(t => t.slug === slug);
}
