# FileNimble

> Any file. Right format.

FileNimble is a web application for converting files with clear format support, processing details, and practical limits. Supported image, PDF, and structured-data tools can process files directly in the browser. Other enabled tools may use temporary server processing; each tool explains its processing mode before conversion.

## Features

- Browser-side image, PDF, and data conversion tools
- File validation based on extension, MIME type, and file contents
- Accessible upload, conversion, and download workflows
- Responsive interface with tool-specific format and size limits
- Optional local backend services for server-processed tools

## Run locally

Requirements: Node.js 22.13 or newer and npm 10 or newer.

```bash
git clone https://github.com/Muhammad-Abrar-Ejaz/FileNimble.git
cd FileNimble
npm install
npm run dev
```

Open `http://localhost:3000`. Browser-side tools work without backend credentials. Server-processed tools require the optional local services to be configured and running.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Playwright browser tests can be run with:

```bash
npx playwright install chromium
npm run test:e2e
```

## Technology

Next.js, React, TypeScript, Tailwind CSS, and PDF.js power the web app. Vitest covers unit and integration tests; Playwright covers browser workflows. The optional conversion backend uses Python and Docker Compose.

## Privacy

Browser-side tools process selected files on the user's device. A tool that requires server processing uploads its input to temporary storage only after the user starts conversion. Check the tool's processing details and limits before using it.

## License

No project-level license file is currently included. Third-party dependencies retain their own licenses; verify and provide any required notices before redistributing built images.
