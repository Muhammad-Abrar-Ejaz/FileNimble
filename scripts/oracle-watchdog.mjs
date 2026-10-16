#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, chmodSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const services = ['api', 'transfers', 'postgres', 'redis', 'storage', 'worker', 'lifecycle', 'supervisor'];
const categories = {
  worker_queue: 'UPTIME_HEARTBEAT_WORKER_QUEUE',
  storage_cleanup: 'UPTIME_HEARTBEAT_STORAGE_CLEANUP',
  conversion_resource: 'UPTIME_HEARTBEAT_CONVERSION_RESOURCE',
};
const statePath = '/var/lib/filenimble-monitor/watchdog.json';
const GiB = 1024 ** 3;

function run(command, args, options = {}) {
  return execFileSync(command, args, {cwd: root, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'], ...options}).trim();
}

function compose(...args) {
  return run('docker', ['compose', '--env-file', '.env.oracle.local', '-f', 'compose.oracle.yaml', ...args]);
}

function validateHeartbeatUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'heartbeat.uptimerobot.com' &&
      (!url.port || url.port === '443') && url.pathname.length > 1 &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function classify(snapshot, allServicesRunning, freeBytes, hotMemoryRuns) {
  return {
    worker_queue: allServicesRunning && snapshot.database_healthy && snapshot.worker_healthy &&
      snapshot.lifecycle_healthy && snapshot.active_jobs < 4 && snapshot.oldest_queued_seconds < 120,
    storage_cleanup: allServicesRunning && snapshot.storage_healthy &&
      snapshot.pending_cleanup_failures === 0 && freeBytes >= 14 * GiB,
    conversion_resource: snapshot.recent_conversion_failures <= 3 && hotMemoryRuns < 5,
  };
}

async function sendHealthyHeartbeats(health, urls, fetchImpl = fetch) {
  const failed = [];
  for (const [category, envName] of Object.entries(categories)) {
    if (!health[category]) {
      failed.push(category);
      continue;
    }
    const url = urls[envName];
    if (!validateHeartbeatUrl(url)) {
      failed.push(category);
      continue;
    }
    try {
      const response = await fetchImpl(url, {method: 'GET', redirect: 'error', signal: AbortSignal.timeout(8000)});
      if (!response.ok) failed.push(category);
    } catch {
      failed.push(category);
    }
  }
  return failed;
}

function readState(path) {
  try {
    const state = JSON.parse(readFileSync(path, 'utf8'));
    return {hotMemoryRuns: Number.isInteger(state.hotMemoryRuns) ? state.hotMemoryRuns : 0};
  } catch {
    return {hotMemoryRuns: 0};
  }
}

async function main() {
  const snapshot = JSON.parse(compose('exec', '-T', 'api', 'python', '-m', 'app.monitor_snapshot'));
  let allServicesRunning = true;
  let hotMemory = false;
  for (const service of services) {
    const id = compose('ps', '-q', service);
    const state = id ? run('docker', ['inspect', '--format', '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', id]) : '';
    if (!id || !state.startsWith('running|') || (state !== 'running|none' && state !== 'running|healthy')) {
      allServicesRunning = false;
      continue;
    }
    const raw = run('docker', ['stats', '--no-stream', '--format', '{{.MemPerc}}', id]);
    const memoryPercent = Number.parseFloat(raw.replace('%', ''));
    if (!Number.isFinite(memoryPercent) || memoryPercent >= 85) hotMemory = true;
  }
  const diskRow = run('df', ['-Pk', root]).split('\n').at(-1).trim().split(/\s+/);
  const freeBytes = Number(diskRow[3]) * 1024;
  const previous = readState(statePath);
  const hotMemoryRuns = hotMemory ? previous.hotMemoryRuns + 1 : 0;
  mkdirSync(dirname(statePath), {recursive: true, mode: 0o700});
  chmodSync(dirname(statePath), 0o700);
  writeFileSync(statePath, JSON.stringify({hotMemoryRuns}), {mode: 0o600});
  chmodSync(statePath, 0o600);
  const health = classify(snapshot, allServicesRunning, freeBytes, hotMemoryRuns);
  const failed = await sendHealthyHeartbeats(health, process.env);
  if (failed.length) {
    process.stderr.write(`Watchdog unhealthy categories: ${failed.join(', ')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Watchdog healthy; configured heartbeats sent.\n');
  }
}

export {classify, sendHealthyHeartbeats, validateHeartbeatUrl};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('Watchdog check failed; no heartbeat sent for unavailable checks.\n');
    process.exitCode = 1;
  });
}
