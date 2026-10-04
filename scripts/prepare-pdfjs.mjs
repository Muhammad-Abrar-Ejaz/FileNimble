import { cp, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules/pdfjs-dist');
const { version } = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
const target = path.join(root, 'public/pdfjs', version);
await mkdir(target, { recursive: true });
for (const name of ['build/pdf.worker.min.mjs', 'cmaps', 'standard_fonts', 'wasm', 'iccs', 'LICENSE']) {
  await cp(path.join(source, name), path.join(target, name), { recursive: true });
}
console.log(`Prepared local PDF.js ${version} assets.`);
