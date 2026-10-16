// Read-only production preflight; does not start containers or reveal interpolated credentials.
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const requireSafe = (ok, message) => { if (!ok) throw new Error(message); };
const envIndex = process.argv.indexOf('--env-file');
const configPath = envIndex >= 0 ? process.argv[envIndex + 1] : '.env.oracle.local';
const env = Object.fromEntries((await readFile(configPath, 'utf8')).trim().split(/\r?\n/).map(line => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));
const secretNames = ['POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'JOB_TOKEN_SECRET', 'CONVERSION_API_SECRET',
  'RUNNER_SECRET', 'TRANSFER_TOKEN_SECRET', 'S3_SECRET_ACCESS_KEY'];
for (const name of secretNames) {
  requireSafe(/^[a-f0-9]{64}$/.test(env[name] || ''), 'Generate fresh production secrets with setup-oracle.mjs.');
}
requireSafe(new Set(secretNames.map(name => env[name])).size === secretNames.length, 'Production secrets must be distinct.');
requireSafe(/^GK[a-f0-9]{32}$/.test(env.S3_ACCESS_KEY_ID || ''), 'Invalid storage access key format.');
requireSafe(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(env.ORACLE_API_HOST || '') &&
  !env.ORACLE_API_HOST.endsWith('.local') && !env.ORACLE_API_HOST.endsWith('.internal'), 'Configure a public DNS hostname.');
if (process.platform !== 'win32') {
  for (const filename of [configPath, 'tmp/oracle/garage.toml']) {
    const info = await stat(filename);
    requireSafe((info.mode & 0o077) === 0, 'Production configuration requires private file permissions (chmod 600).');
  }
}
const args = ['compose', '--env-file', configPath, '-f', 'compose.oracle.yaml'];
let config;
try {
  // Suppress Compose diagnostics: configuration errors could include interpolated values.
  config = JSON.parse(execFileSync('docker', [...args, 'config', '--format', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
} catch { throw new Error('Compose configuration validation failed. Check required variable names and Docker Compose.'); }
requireSafe(config.name === 'filenimble-oracle', 'Unexpected Compose project.');
for (const [name, service] of Object.entries(config.services)) {
  requireSafe(service.platform === 'linux/arm64', 'All production images must target ARM64.');
  if (name !== 'edge') requireSafe(!service.ports?.length, 'Only the TLS edge may publish ports.');
  if (name !== 'supervisor') requireSafe(!service.volumes?.some(v => v.source?.includes('docker.sock')), 'Docker socket is supervisor-only.');
  if (name.endsWith('-image')) continue;
  requireSafe(service.mem_limit && service.pids_limit && service.cpus, 'Runtime resource bounds are required.');
}
const services = config.services;
const siteOrigin = 'https://www.filenimble.app';
for (const name of ['api', 'transfers']) {
  requireSafe(services[name].environment.SITE_ORIGIN === siteOrigin,
    'Production browser origin must match the verified FileNimble site.');
}
const caddyfile = await readFile('deploy/oracle/Caddyfile', 'utf8');
requireSafe(caddyfile.includes('reverse_proxy transfers:8002') &&
  caddyfile.includes('reverse_proxy api:8000') && caddyfile.includes('respond 404') &&
  !/storage|garage|3900/i.test(caddyfile),
'Public edge routes must expose only the API and scoped transfer gateway.');
const releaseScope = JSON.parse(await readFile('worker/production_tools.json', 'utf8'));
const allowlist = services.api.environment.PRODUCTION_TOOL_ALLOWLIST || '';
const allowedTools = allowlist ? allowlist.split(',') : [];
requireSafe(allowlist.length <= 256 && new Set(allowedTools).size === allowedTools.length &&
  allowedTools.every(tool => releaseScope.includes(tool)), 'Invalid production converter allowlist.');
for (const name of ['api', 'worker', 'lifecycle', 'transfers', 'supervisor']) {
  requireSafe(services[name].environment.APP_ENV === 'production',
    'Production execution boundaries must explicitly use production mode.');
  requireSafe((services[name].environment.PRODUCTION_TOOL_ALLOWLIST || '') === allowlist &&
    services[name].environment.PRODUCTION_CONVERSIONS_ENABLED === services.api.environment.PRODUCTION_CONVERSIONS_ENABLED,
  'Production execution boundaries must share the same converter release policy.');
}
requireSafe(services.edge.ports?.length === 2 && services.edge.ports.every(p => [80, 443].includes(Number(p.published))), 'Edge must publish only TCP 80 and 443.');
for (const name of ['database', 'queue', 'objects', 'control']) requireSafe(config.networks[name]?.internal === true, 'Private networks must remain internal.');
for (const name of ['postgres', 'redis', 'storage', 'supervisor', 'worker', 'lifecycle']) {
  requireSafe(!Object.keys(services[name].networks).includes('edge'), 'Private service cannot join the edge network.');
}
requireSafe(services.api.environment.AI_ENABLED === 'false' && !services.api.environment.GEMINI_API_KEY, 'AI must remain disabled during preparation.');
requireSafe(services.api.environment.PRODUCTION_CONVERSIONS_ENABLED === 'false', 'Initial production conversions must remain disabled until on-host qualification.');
requireSafe(services.api.environment.ENABLE_NATIVE_QUALIFICATION === '0' && services.api.environment.ENABLE_TEST_CAPABILITY === '0', 'Test capabilities must never be enabled in production.');
requireSafe(services.worker.command.includes('--concurrency=1'), 'Worker concurrency must remain one.');
requireSafe(services.supervisor.environment.RUNNER_NAMESPACE === 'oracle-native', 'Production reaper requires a distinct namespace.');
const memory = Object.values(services).reduce((sum, s) => sum + Number(s.mem_limit || 0), 0);
requireSafe(memory < 4 * 1024 ** 3, 'Service memory limits exceed the conservative budget.');
if (process.argv.includes('--host')) {
  requireSafe(process.platform === 'linux' && process.arch === 'arm64', 'Host qualification requires Linux ARM64.');
  let info;
  try { info = JSON.parse(execFileSync('docker', ['info', '--format', '{{json .}}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch { throw new Error('Docker daemon is unavailable.'); }
  requireSafe(['aarch64', 'arm64'].includes(info.Architecture), 'Docker host must be ARM64.');
  requireSafe(info.MemTotal >= 10 * 1024 ** 3, 'Host needs at least 10 GiB available physical RAM.');
  requireSafe(info.SecurityOptions?.some(s => s.includes('seccomp')), 'Docker default seccomp is required.');
  const dockerRoot = info.DockerRootDir;
  const free = Number(execFileSync('df', ['-PB1', dockerRoot], { encoding: 'utf8' }).trim().split('\n').at(-1).trim().split(/\s+/)[3]);
  requireSafe(free >= 12 * 1024 ** 3, 'Keep at least 12 GiB disk headroom after image builds.');
}
console.log(`PASS: isolated ARM64 configuration; ${Math.round(memory / 1024 ** 2)} MiB service caps plus one bounded native job.`);
console.log('This validates configuration only. DNS/TLS, engine builds, lifecycle, load and host firewall still require verification.');
