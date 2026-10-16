import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.backend.local');
try { await access(envPath); console.log('Local backend configuration already exists; preserved.'); }
catch {
  const secret = () => randomBytes(32).toString('hex');
  const values = { POSTGRES_PASSWORD:secret(), REDIS_PASSWORD:secret(), JOB_TOKEN_SECRET:secret(), CONVERSION_API_SECRET:secret(), RUNNER_SECRET:secret(), TRANSFER_TOKEN_SECRET:secret(), S3_ACCESS_KEY_ID:'GK'+randomBytes(16).toString('hex'), S3_SECRET_ACCESS_KEY:secret() };
  await mkdir(path.join(root, 'tmp'), {recursive:true});
  const config = ['metadata_dir = "/var/lib/garage/meta"','data_dir = "/var/lib/garage/data"','db_engine = "sqlite"','replication_factor = 1','rpc_bind_addr = "[::]:3901"','rpc_public_addr = "127.0.0.1:3901"','rpc_secret = "'+secret()+'"','[s3_api]','s3_region = "garage"','api_bind_addr = "[::]:3900"',''].join('\n');
  await writeFile(path.join(root, 'tmp/garage.toml'), config, {flag:'wx'});
  await writeFile(envPath, Object.entries(values).map(([key,value])=>key+'='+value).join('\n')+'\n', {flag:'wx',mode:0o600});
  console.log('Created ignored local configuration. No secrets printed.');
}
