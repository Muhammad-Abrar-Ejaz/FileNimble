import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

test('generator creates fresh private configuration and refuses to overwrite credentials', async () => {
  await mkdir('tmp', { recursive: true });
  const root = await mkdtemp(path.resolve('tmp/oracle-setup-'));
  await mkdir(path.join(root, 'scripts'));
  await copyFile('scripts/setup-oracle.mjs', path.join(root, 'scripts/setup-oracle.mjs'));
  const args = [path.join(root, 'scripts/setup-oracle.mjs'), '--host', 'backend.example.org', '--email', 'ops@example.org'];
  const output = execFileSync(process.execPath, args, { encoding: 'utf8' });
  const before = await readFile(path.join(root, '.env.oracle.local'), 'utf8');
  const env = Object.fromEntries(before.trim().split('\n').map(line => line.split('=')));
  const secretNames = ['POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'JOB_TOKEN_SECRET', 'CONVERSION_API_SECRET', 'RUNNER_SECRET', 'TRANSFER_TOKEN_SECRET', 'S3_SECRET_ACCESS_KEY'];
  assert.equal(new Set(secretNames.map(key => env[key])).size, secretNames.length);
  for (const name of secretNames) {
    assert.match(env[name], /^[a-f0-9]{64}$/);
    assert.ok(!output.includes(env[name]));
  }
  assert.equal(env.PRODUCTION_CONVERSIONS_ENABLED, 'false');
  assert.match(await readFile(path.join(root, 'tmp/oracle/garage.toml'), 'utf8'), /rpc_bind_addr = "127.0.0.1:3901"/);
  if (process.platform !== 'win32') assert.equal((await stat(path.join(root, '.env.oracle.local'))).mode & 0o077, 0);
  assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }));
  assert.equal(await readFile(path.join(root, '.env.oracle.local'), 'utf8'), before);
  assert.throws(() => execFileSync(process.execPath, [args[0], '--host', '127.0.0.1', '--email', 'ops@example.org'], { stdio: 'pipe' }));
});
