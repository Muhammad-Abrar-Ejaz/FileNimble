import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MEDIA_TOOLS } from '@/config/mediaTools';
import { DocumentConverterClient } from './DocumentConverterClient';

const calls: Array<{ url: string; method: string; body?: string }> = [];
const xhrCalls: Array<{ method: string; url: string; headers: Record<string, string>; body: XMLHttpRequestBodyInit | null; withCredentials: boolean }> = [];
let serverState: 'COMPLETED' | 'EXPIRED' = 'COMPLETED';
let createStatus = 201;

vi.mock('@/components/uploader/UniversalUploader', () => ({
  UniversalUploader: ({ onFilesChange }: { onFilesChange: (files: Array<{ id: string; file: File; status: 'valid' }>) => void }) => <button type="button" onClick={() => onFilesChange([{ id: 'fixture', file: new File(['fixture bytes'], 'fixture.tar', { type: 'application/x-tar' }), status: 'valid' }])}>Select synthetic archive</button>,
}));
vi.mock('@/components/tools/PrivacyBadge', () => ({ PrivacyBadge: () => null }));

class FakeXHR {
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onloadend: (() => void) | null = null;
  withCredentials = true;
  status = 0;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send(body: XMLHttpRequestBodyInit | null) {
    xhrCalls.push({ method: this.method, url: this.url, headers: this.headers, body, withCredentials: this.withCredentials });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
    setTimeout(() => { this.status = 204; this.onload?.(); this.onloadend?.(); }, 25);
  }
  abort() { this.onabort?.(); this.onloadend?.(); }
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function serverFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const method = init?.method || 'GET';
  const body = typeof init?.body === 'string' ? init.body : undefined;
  calls.push({ url, method, body });
  if (url.endsWith('/api/v1/jobs') && method === 'POST') {
    if (createStatus !== 201) return Promise.resolve(response({ error: 'SERVICE_UNAVAILABLE', message: 'Server processing is not configured.' }, createStatus));
    return Promise.resolve(response({
      jobId: '12345678-1234-4234-8234-123456789012', state: 'UPLOADING', expiresAt: new Date(Date.now() + 60_000).toISOString(),
      uploads: [{ fileId: '22345678-1234-4234-8234-123456789012', method: 'PUT', url: 'https://transfer.example.test/transfers/synthetic-token', headers: { 'Content-Type': 'application/octet-stream' } }],
    }, 201));
  }
  if (url.endsWith('/complete-upload')) return Promise.resolve(response({ state: 'QUEUED' }));
  if (/\/api\/v1\/jobs\/[0-9a-f-]+$/.test(url)) {
    if (serverState === 'EXPIRED') return Promise.resolve(response({ error: 'JOB_EXPIRED', message: 'This job is no longer available.' }, 410));
    return Promise.resolve(response({ state: 'COMPLETED', files: [{ fileId: '22345678-1234-4234-8234-123456789012', bytes: 14, mediaType: 'application/zip' }] }));
  }
  if (url.endsWith('/download-token')) return Promise.resolve(response({ url: 'https://transfer.example.test/transfers/download-token', expiresIn: 60 }));
  return Promise.resolve(response({ state: 'CANCELLED' }));
}

describe('DocumentConverterClient server workflow', () => {
  beforeEach(() => {
    calls.length = 0; xhrCalls.length = 0; serverState = 'COMPLETED'; createStatus = 201;
    vi.stubGlobal('fetch', vi.fn(serverFetch));
    vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const tool = MEDIA_TOOLS.find(item => item.slug === 'tar-to-zip')!;

  it('uploads without browser credentials, reports progress, polls once, and requests a private download token', async () => {
    render(<DocumentConverterClient tool={tool} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select synthetic archive' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Upload and convert' }));
    expect(await screen.findByLabelText('Upload progress')).toBeTruthy();
    expect(await screen.findByText('50%')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Download' })).toBeTruthy();

    const create = calls.find(call => call.url.endsWith('/api/v1/jobs') && call.method === 'POST')!;
    expect(JSON.parse(create.body!).tool).toBe('tar-to-zip');
    expect(create.body).not.toContain('fixture bytes');
    expect(xhrCalls).toHaveLength(1);
    expect(xhrCalls[0]).toMatchObject({ method: 'PUT', withCredentials: false, headers: { 'Content-Type': 'application/octet-stream' } });
    expect(xhrCalls[0].url).toContain('synthetic-token');
    expect(calls.some(call => call.url.endsWith('/complete-upload'))).toBe(true);
    expect(calls.filter(call => /\/api\/v1\/jobs\/[0-9a-f-]+$/.test(call.url))).toHaveLength(1);

    let attachedDuringClick = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      attachedDuringClick = this.isConnected;
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(attachedDuringClick).toBe(true);
    expect(anchor.isConnected).toBe(false);
    expect(anchor.href).toBe('https://transfer.example.test/transfers/download-token');
    expect(anchor.rel).toContain('noreferrer');
    expect(anchor.referrerPolicy).toBe('no-referrer');
    expect(calls.some(call => call.url.endsWith('/download-token'))).toBe(true);
  });

  it('does not create a job when the same convert action is activated twice', async () => {
    render(<DocumentConverterClient tool={tool} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select synthetic archive' }));
    const button = await screen.findByRole('button', { name: 'Upload and convert' });
    fireEvent.click(button); fireEvent.click(button);
    await screen.findByRole('button', { name: 'Download' });
    expect(calls.filter(call => call.url.endsWith('/api/v1/jobs') && call.method === 'POST')).toHaveLength(1);
  });

  it('reports an expired job and never tries to download it', async () => {
    serverState = 'EXPIRED';
    render(<DocumentConverterClient tool={tool} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select synthetic archive' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Upload and convert' }));
    expect(await screen.findByRole('heading', { name: 'Session Expired' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('shows a safe configuration failure before sending file bytes', async () => {
    createStatus = 503;
    render(<DocumentConverterClient tool={tool} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select synthetic archive' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Upload and convert' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Server processing is not configured.');
    expect(xhrCalls).toHaveLength(0);
  });
});
