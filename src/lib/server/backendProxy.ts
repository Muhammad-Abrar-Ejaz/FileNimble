import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'node:net';

const endpoint = /^jobs(?:\/[0-9a-f-]{36}(?:\/(?:complete-upload|cancel|download-token))?)?$|^tools(?:\/[a-z0-9-]+)?$|^ai\/(?:status|process)$/;

export async function backendProxy(request: NextRequest, segments: string[]) {
  const path = segments.join('/');
  const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Robots-Tag':'noindex, nofollow' };
  const error = (status: number, code: string, message: string) => NextResponse.json({error:code,message},{status,headers});
  if (!endpoint.test(path)) return error(404,'INVALID_REQUEST','Unknown endpoint.');
  const base = process.env.CONVERSION_API_URL;
  const key = process.env.CONVERSION_API_SECRET;
  if (!base || !key) return error(503,'SERVICE_UNAVAILABLE','Server processing is not configured.');
  const production = process.env.APP_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  let expected: string;
  try {
    const target = new URL(base);
    const site = new URL(process.env.SITE_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || request.url);
    expected = site.origin;
    if (target.username || target.password || target.search || target.hash || target.pathname !== '/' ||
        !['http:', 'https:'].includes(target.protocol) ||
        (production && (target.protocol !== 'https:' || !process.env.SITE_ORIGIN ||
          site.protocol !== 'https:' || site.username || site.password || site.search || site.hash || site.pathname !== '/'))) {
      return error(503,'SERVICE_UNAVAILABLE','Server processing is not configured securely.');
    }
  } catch { return error(503,'SERVICE_UNAVAILABLE','Server processing is not configured securely.'); }
  if (!['GET','POST','DELETE'].includes(request.method)) return error(405,'INVALID_REQUEST','Method not supported.');
  if (request.method !== 'GET') {
    if (request.headers.get('origin') !== expected) return error(403,'NOT_AUTHORIZED','Request origin is not allowed.');
  }
  const upstream = new Headers({'x-internal-key':key,'Content-Type':'application/json'});
  // Set this only behind a reverse proxy that replaces the specified header.
  const ipHeader = process.env.VERCEL_ENV === 'production' ? 'x-vercel-forwarded-for' : process.env.TRUSTED_CLIENT_IP_HEADER;
  const clientIP = ipHeader ? request.headers.get(ipHeader)?.split(',')[0].trim() : undefined;
  upstream.set('x-client-ip',clientIP && isIP(clientIP) ? clientIP : ipHeader ? 'unknown' : 'local');
  const session = request.cookies.get('fn_session');
  if (session) upstream.set('cookie','fn_session='+encodeURIComponent(session.value));
  const idempotency = request.headers.get('idempotency-key');
  if (idempotency) upstream.set('idempotency-key',idempotency);
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (request.method === 'POST') {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    const maxBodyBytes = path === 'ai/process' ? 50 * 1024 : 16384;
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > maxBodyBytes) { await reader.cancel(); return error(413,'FILE_TOO_LARGE','API request is too large.'); }
        chunks.push(chunk.value);
      }
    }
    body = new Uint8Array(length);
    let offset=0; for (const chunk of chunks) { body.set(chunk,offset); offset+=chunk.length; }
  }
  try {
    const response = await fetch(base.replace(/\/$/,'')+'/api/v1/'+path,{method:request.method,headers:upstream,body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(path === 'ai/process' ? 25000 : 15000)});
    const result = new NextResponse(await response.arrayBuffer(),{status:response.status,headers:{...headers,'Content-Type':'application/json'}});
    const cookie = response.headers.get('set-cookie');
    if (cookie) result.headers.set('set-cookie',cookie);
    return result;
  } catch { return error(503,'SERVICE_UNAVAILABLE','Server processing is temporarily unavailable.'); }
}
