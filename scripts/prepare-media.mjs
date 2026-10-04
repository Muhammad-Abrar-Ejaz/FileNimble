// Cache only the public, pinned upstream source. No uploaded files or credentials.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = new URL('../tmp/ffmpeg-source/', import.meta.url);
const path = new URL('ffmpeg-8.1.3.tar.xz', directory);
const expected = '7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3';
const valid = data => createHash('sha256').update(data).digest('hex') === expected;
await mkdir(directory, { recursive: true });
let data;
try { data = await readFile(path); } catch { /* Download below. */ }
if (!data || !valid(data)) {
  const response = await fetch('https://ffmpeg.org/releases/ffmpeg-8.1.3.tar.xz', { signal: AbortSignal.timeout(300000) });
  if (!response.ok) throw new Error('FFmpeg source download failed');
  data = Buffer.from(await response.arrayBuffer());
  if (!valid(data)) throw new Error('FFmpeg source hash mismatch');
  await writeFile(path, data);
}
console.log(`Verified FFmpeg 8.1.3 source cache: ${fileURLToPath(directory)}`);
