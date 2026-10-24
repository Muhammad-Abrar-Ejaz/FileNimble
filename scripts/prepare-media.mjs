// Cache only the public, pinned upstream source. No uploaded files or credentials.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = new URL('../tmp/ffmpeg-source/', import.meta.url);
const path = new URL('ffmpeg-8.1.3.tar.xz', directory);
const expected = '7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3';
const valid = data => createHash('sha256').update(data).digest('hex') === expected;
const sources = [
  'https://ffmpeg.org/releases/ffmpeg-8.1.3.tar.xz',
  // A mirror fallback keeps CI resilient when the upstream host is unreachable.
  // The same pinned SHA-256 is required for every source before caching or use.
  'https://mirror.math.princeton.edu/pub/macports/distfiles/ffmpeg/ffmpeg-8.1.3.tar.xz',
];
await mkdir(directory, { recursive: true });
let data;
try { data = await readFile(path); } catch { /* Download below. */ }
if (!data || !valid(data)) {
  let lastFailure = 'unknown';
  for (const source of sources) {
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(300000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const candidate = Buffer.from(await response.arrayBuffer());
      if (!valid(candidate)) throw new Error('SHA-256 mismatch');
      data = candidate;
      break;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : 'unknown error';
      console.warn(`Pinned FFmpeg source unavailable from ${new URL(source).hostname}; trying the next source.`);
    }
  }
  if (!data) throw new Error(`All pinned FFmpeg source locations failed: ${lastFailure}`);
  await writeFile(path, data);
}
console.log(`Verified FFmpeg 8.1.3 source cache: ${fileURLToPath(directory)}`);
