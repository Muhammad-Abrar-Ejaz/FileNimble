// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const compose = parse(readFileSync('compose.oracle.yaml', 'utf8'), { merge: true });
describe('standalone Oracle deployment boundaries', () => {
  it('prevents automatic Vercel deployments for the Oracle testing branch only', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(vercel.git.deploymentEnabled).toEqual({ 'deploy/oracle-phase13': false });
    expect(vercel.buildCommand).toBeUndefined();
  });
  it('publishes only HTTPS edge ports and isolates stateful services', () => {
    expect(compose.name).toBe('filenimble-oracle');
    expect(compose.services.edge.ports).toEqual(['80:80', '443:443']);
    for (const [name, service] of Object.entries(compose.services) as [string, Record<string, unknown>][]) {
      expect(service.platform).toBe('linux/arm64');
      if (name !== 'edge') expect(service.ports).toBeUndefined();
      if (name !== 'supervisor') expect(JSON.stringify(service.volumes || [])).not.toContain('docker.sock');
      if (name.endsWith('-image')) continue;
      expect(service.mem_limit).toBeTruthy();
      expect(service.pids_limit).toBeTruthy();
      expect(service.security_opt).toContain('no-new-privileges:true');
      expect(service.cap_drop).toEqual(['ALL']);
    }
    for (const network of ['database', 'queue', 'objects', 'control']) expect(compose.networks[network].internal).toBe(true);
    for (const service of ['postgres', 'redis', 'storage', 'supervisor', 'worker', 'lifecycle']) expect(compose.services[service].networks).not.toContain('edge');
  });
  it('keeps AI, unqualified tools and fixture capabilities off by default', () => {
    const env = compose.services.api.environment;
    expect(env.AI_ENABLED).toBe('false');
    expect(env.GEMINI_API_KEY).toBe('');
    expect(env.PRODUCTION_CONVERSIONS_ENABLED).toBe('${PRODUCTION_CONVERSIONS_ENABLED:-false}');
    expect(env.ENABLE_TEST_CAPABILITY).toBe('0');
    expect(env.ENABLE_NATIVE_QUALIFICATION).toBe('0');
    expect(compose.services.supervisor.environment.RUNNER_NAMESPACE).toBe('oracle-native');
    expect(compose.services.worker.command).toContain('--concurrency=1');
    expect(compose.services.transfers.environment.CONVERSION_API_SECRET).toBeUndefined();
    expect(compose.services.worker.environment.TRANSFER_TOKEN_SECRET).toBeUndefined();
    expect(compose.services.api.environment.S3_ENDPOINT).toBe('http://storage:3900');
  });
  it('references real Dockerfiles and existing build stages', () => {
    for (const service of Object.values(compose.services) as { build?: { dockerfile: string; target?: string } }[]) {
      if (!service.build) continue;
      expect(existsSync(service.build.dockerfile)).toBe(true);
      if (service.build.target) expect(readFileSync(service.build.dockerfile, 'utf8')).toContain(`AS ${service.build.target}`);
    }
    const media = readFileSync('worker/engines/Media.Dockerfile', 'utf8');
    expect(media).not.toContain('x86_64-linux-gnu');
    expect(media).toContain('--disable-gpl --disable-nonfree');
  });
  it('bounds edge bodies and redacts bearer grants from error logs', () => {
    const caddy = readFileSync('deploy/oracle/Caddyfile', 'utf8');
    expect(caddy).toContain('admin off');
    expect(caddy).toContain('max_size 25MiB');
    expect(caddy).toContain('max_size 64KiB');
    expect(caddy).toContain('write 120s');
    expect(caddy).toContain('request>uri delete');
    expect(caddy).toContain('request>headers delete');
    expect(caddy).not.toContain('storage:3900');
  });
});
