// Generates fresh ignored production credentials; never prints or reuses local secrets.
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
const host = args.includes('--host') ? option('--host') : '';
const email = args.includes('--email') ? option('--email') : '';
if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
    host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.example') ||
    !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(email)) {
  throw new Error('Use --host <your-public-DNS-hostname> --email <your-ACME-contact>.');
}
const envPath = path.join(root, '.env.oracle.local');
try {
  await access(envPath);
  throw new Error('Oracle configuration already exists. Preserved; do not regenerate live credentials.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const secret = () => randomBytes(32).toString('hex');
const values = {
  ORACLE_API_HOST: host, TLS_EMAIL: email,
  POSTGRES_PASSWORD: secret(), REDIS_PASSWORD: secret(), JOB_TOKEN_SECRET: secret(),
  CONVERSION_API_SECRET: secret(), RUNNER_SECRET: secret(), TRANSFER_TOKEN_SECRET: secret(),
  S3_ACCESS_KEY_ID: 'GK' + randomBytes(16).toString('hex'), S3_SECRET_ACCESS_KEY: secret(),
  PRODUCTION_CONVERSIONS_ENABLED: 'false',
};
const directory = path.join(root, 'tmp/oracle');
await mkdir(directory, { recursive: true, mode: 0o700 });
const garage = [
  'metadata_dir = "/var/lib/garage/meta"', 'data_dir = "/var/lib/garage/data"',
  'db_engine = "sqlite"', 'replication_factor = 1',
  'rpc_bind_addr = "127.0.0.1:3901"', 'rpc_public_addr = "127.0.0.1:3901"',
  'rpc_secret = "' + secret() + '"', '[s3_api]', 's3_region = "garage"',
  'api_bind_addr = "[::]:3900"', '',
].join('\n');
await writeFile(path.join(directory, 'garage.toml'), garage, { flag: 'wx', mode: 0o600 });
await writeFile(envPath, Object.entries(values).map(([key, value]) => key + '=' + value).join('\n') + '\n',
  { flag: 'wx', mode: 0o600 });
console.log('Created .env.oracle.local and tmp/oracle/garage.toml (ignored, private permissions).');
console.log('Conversions and AI remain disabled. No services started and no secrets printed.');
