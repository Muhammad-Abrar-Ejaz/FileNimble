import assert from 'node:assert/strict';
import test from 'node:test';
import {classify, sendHealthyHeartbeats, validateHeartbeatUrl} from './oracle-watchdog.mjs';

const healthySnapshot = {
  database_healthy: true,
  storage_healthy: true,
  worker_healthy: true,
  lifecycle_healthy: true,
  active_jobs: 1,
  oldest_queued_seconds: 12,
  recent_conversion_failures: 0,
  pending_cleanup_failures: 0,
};

test('watchdog marks bounded healthy state green and unhealthy signals red', () => {
  assert.deepEqual(classify(healthySnapshot, true, 20 * 1024 ** 3, 0), {
    worker_queue: true,
    storage_cleanup: true,
    conversion_resource: true,
  });
  assert.deepEqual(classify({...healthySnapshot, active_jobs: 4, pending_cleanup_failures: 1}, true, 10 * 1024 ** 3, 5), {
    worker_queue: false,
    storage_cleanup: false,
    conversion_resource: false,
  });
});

test('watchdog pings only healthy categories and does not follow redirects', async () => {
  const calls = [];
  const urls = {
    UPTIME_HEARTBEAT_WORKER_QUEUE: 'https://heartbeat.uptimerobot.com/test-worker-token',
    UPTIME_HEARTBEAT_STORAGE_CLEANUP: 'https://heartbeat.uptimerobot.com/test-storage-token',
    UPTIME_HEARTBEAT_CONVERSION_RESOURCE: 'https://heartbeat.uptimerobot.com/test-conversion-token',
  };
  const failed = await sendHealthyHeartbeats(
    {worker_queue: true, storage_cleanup: false, conversion_resource: true},
    urls,
    async (url, options) => { calls.push({url, options}); return {ok: true}; },
  );
  assert.deepEqual(failed, ['storage_cleanup']);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({options}) => options.method === 'GET' && options.redirect === 'error'));
  assert.equal(validateHeartbeatUrl('http://heartbeat.uptimerobot.com/bad'), false);
  assert.equal(validateHeartbeatUrl('https://evil.example/token'), false);
  assert.equal(validateHeartbeatUrl('https://heartbeat.uptimerobot.com/'), false);
  assert.equal(validateHeartbeatUrl('https://heartbeat.uptimerobot.com/token?debug=true'), false);
});

test('missing or failed heartbeat deliveries fail closed without printing URLs', async () => {
  const failed = await sendHealthyHeartbeats(
    {worker_queue: true, storage_cleanup: true, conversion_resource: true},
    {},
    async () => { throw new Error('synthetic transport failure'); },
  );
  assert.deepEqual(failed, ['worker_queue', 'storage_cleanup', 'conversion_resource']);
});
