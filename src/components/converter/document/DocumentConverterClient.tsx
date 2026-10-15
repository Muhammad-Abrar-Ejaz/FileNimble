'use client';

import { useEffect, useRef, useState } from 'react';
import type { DocumentTool } from '@/config/documentTools';
import { UniversalUploader } from '@/components/uploader/UniversalUploader';
import { PrivacyBadge } from '@/components/tools/PrivacyBadge';
import { ConverterStateView } from '../ConverterStateView';
import { useConverterState } from '../useConverterState';
import type { ApiErrorCode, CreateJobResponse } from '@/types/api';

type ApiResult = Record<string, unknown>;

class ApiFailure extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = 'ApiFailure';
  }
}

async function api(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<ApiResult> {
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (method === 'POST' && path === 'jobs') headers.set('Idempotency-Key', crypto.randomUUID());
  const response = await fetch('/api/v1/' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store', credentials: 'same-origin', signal,
  });
  let result: unknown;
  try { result = await response.json(); } catch { result = undefined; }
  const payload = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  if (!response.ok) {
    const message = typeof payload.message === 'string' && payload.message.length <= 300
      ? payload.message : 'Server processing is temporarily unavailable.';
    throw new ApiFailure(message, typeof payload.error === 'string' ? payload.error : 'SERVICE_UNAVAILABLE', response.status);
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new ApiFailure('The server returned an invalid response. Try again.', 'SERVICE_UNAVAILABLE', response.status);
  }
  return payload;
}

function safeTransferUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, window.location.origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) return null;
    if (window.location.protocol === 'https:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch { return null; }
}

function uploadFile(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.withCredentials = false;
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve() : reject(new Error('The upload failed. Clear the file and try again.'));
    xhr.onerror = () => reject(new Error('The upload could not reach temporary storage. Check your connection and try again.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'));
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort, { once: true });
    xhr.onloadend = () => signal.removeEventListener('abort', abort);
    if (signal.aborted) { xhr.abort(); return; }
    xhr.send(file);
  });
}

function checkedUpload(created: ApiResult) {
  const uploads = created.uploads;
  if (!Array.isArray(uploads) || uploads.length !== 1) throw new Error('The server did not provide a valid upload. Clear the file and try again.');
  const grant = uploads[0] as Record<string, unknown>;
  const url = safeTransferUrl(grant.url);
  const headers = grant.headers;
  if (grant.method !== 'PUT' || !url || !headers || typeof headers !== 'object' || Array.isArray(headers)) {
    throw new Error('The server did not provide a valid upload. Clear the file and try again.');
  }
  const entries = Object.entries(headers as Record<string, unknown>);
  if (entries.length !== 1 || entries[0][0].toLowerCase() !== 'content-type' || entries[0][1] !== 'application/octet-stream') {
    throw new Error('The server provided unsupported upload instructions. Clear the file and try again.');
  }
  return { url, headers: { 'Content-Type': 'application/octet-stream' } };
}

function errorCode(error: unknown): ApiErrorCode {
  const allowed: ApiErrorCode[] = ['UNSUPPORTED_FORMAT', 'FILE_TOO_LARGE', 'TOO_MANY_FILES', 'CORRUPT_FILE', 'PASSWORD_REQUIRED', 'INVALID_PASSWORD', 'UNSUPPORTED_DOCUMENT_FEATURE', 'CONVERSION_TIMEOUT', 'RESOURCE_LIMIT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'JOB_EXPIRED', 'NOT_AUTHORIZED'];
  return error instanceof ApiFailure && allowed.includes(error.code as ApiErrorCode)
    ? error.code as ApiErrorCode : 'SERVICE_UNAVAILABLE';
}

function isExpired(error: unknown) {
  return error instanceof ApiFailure && (error.status === 410 || error.code === 'JOB_EXPIRED');
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function DocumentConverterClient({ tool }: { tool: DocumentTool }) {
  const [cleanup, setCleanup] = useState(true);
  const { state, setFiles, startProcessing, setComplete, setFailed, cancel, reset, setExpired } = useConverterState();
  const generation = useRef(0), job = useRef<string | null>(null), request = useRef<AbortController | null>(null);
  const upload = useRef<AbortController | null>(null), running = useRef(false);
  const [uploaderKey, setUploaderKey] = useState(0), [downloadError, setDownloadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const resultId = useRef<string | null>(null);

  useEffect(() => () => {
    generation.current++;
    request.current?.abort(); upload.current?.abort();
    if (job.current) void api('jobs/' + job.current, 'DELETE').catch(() => {});
  }, []);

  function clear() {
    generation.current++; running.current = false;
    request.current?.abort(); upload.current?.abort();
    if (job.current) void api('jobs/' + job.current, 'DELETE').catch(() => {});
    job.current = null; resultId.current = null; request.current = null; upload.current = null;
    setUploadProgress(null); setDownloadError(''); reset(); setUploaderKey(value => value + 1);
  }

  async function convert() {
    const file = state.files.find(item => item.status === 'valid')?.file;
    if (!file || running.current) return;
    running.current = true;
    const version = ++generation.current;
    const controller = new AbortController(); request.current = controller;
    setUploadProgress(null); setDownloadError('');
    startProcessing('Creating a temporary server job…');
    try {
      const created = await api('jobs', 'POST', { tool: tool.slug, files: [{ name: file.name, size: file.size, type: file.type }], ...(tool.ocr ? { options: { language: 'eng', cleanup } } : {}) }, controller.signal) as unknown as CreateJobResponse;
      if (!isUuid(created.jobId)) throw new Error('The server returned an invalid job. Try again.');
      if (version !== generation.current) { void api('jobs/' + created.jobId, 'DELETE').catch(() => {}); return; }
      job.current = created.jobId;
      const expiresAt = Date.parse(created.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new ApiFailure('This temporary job has expired. Start a new conversion.', 'JOB_EXPIRED', 410);
      const grant = checkedUpload(created as unknown as ApiResult);
      const uploadController = new AbortController(); upload.current = uploadController;
      setUploadProgress(0);
      startProcessing('Uploading to temporary private storage…');
      await uploadFile(grant.url, grant.headers, file, setUploadProgress, uploadController.signal);
      if (version !== generation.current) return;
      setUploadProgress(null); upload.current = null;
      await api('jobs/' + created.jobId + '/complete-upload', 'POST', undefined, controller.signal);
      const deadline = Math.min(Date.now() + 180000, expiresAt);
      let delay = 600;
      while (version === generation.current && Date.now() < deadline) {
        const status = await api('jobs/' + created.jobId, 'GET', undefined, controller.signal);
        if (version !== generation.current) return;
        if (status.state === 'COMPLETED') {
          const output = Array.isArray(status.files) ? status.files[0] as Record<string, unknown> | undefined : undefined;
          if (!output || !isUuid(output.fileId) || typeof output.bytes !== 'number' || !Number.isSafeInteger(output.bytes) || output.bytes < 0) {
            throw new Error('The server did not return a valid converted file. Clear the job and try again.');
          }
          resultId.current = output.fileId;
          setComplete([{ name: tool.slug + '-result.' + tool.output, size: output.bytes, mimeType: typeof output.mediaType === 'string' ? output.mediaType : undefined }]);
          return;
        }
        if (status.state === 'EXPIRED') { job.current = null; resultId.current = null; setExpired(); return; }
        if (status.state === 'CANCELLED') { job.current = null; cancel(); return; }
        if (status.state === 'FAILED') throw new ApiFailure('The document could not be converted within the supported format and resource limits. Check the supported formats and limits below; no result is available.', typeof status.error === 'string' ? status.error : 'CORRUPT_FILE', 422);
        const progress = typeof status.progress === 'number' && Number.isFinite(status.progress) ? ` (${Math.min(100, Math.max(0, Math.round(status.progress)))}%)` : '';
        startProcessing((status.state === 'QUEUED' ? 'Waiting for an isolated conversion worker' : 'Validating and converting your document') + progress + '…');
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(3000, Math.round(delay * 1.6));
      }
      if (version === generation.current) {
        void api('jobs/' + created.jobId + '/cancel', 'POST').catch(() => {});
        throw new ApiFailure('Processing took too long. Clear the file to request early cleanup, or try a smaller document.', 'CONVERSION_TIMEOUT', 408);
      }
    } catch (error) {
      if (version === generation.current) {
        if (isExpired(error)) { job.current = null; resultId.current = null; setExpired(); }
        else if (error instanceof DOMException && error.name === 'AbortError') cancel();
        else setFailed(errorCode(error), error instanceof Error ? error.message : 'Conversion failed.');
      }
    } finally {
      if (version === generation.current) {
        running.current = false; request.current = null; upload.current = null; setUploadProgress(null);
      }
    }
  }

  function stop() {
    generation.current++; running.current = false;
    request.current?.abort(); upload.current?.abort();
    if (job.current) void api('jobs/' + job.current + '/cancel', 'POST').catch(() => setDownloadError('Cancellation could not be confirmed. Clear the file to request deletion.'));
    cancel(); setUploadProgress(null);
  }

  async function download() {
    if (!job.current || !resultId.current || running.current) return;
    const version = generation.current;
    const controller = new AbortController(); request.current = controller;
    setDownloadError('');
    try {
      const grant = await api('jobs/' + job.current + '/download-token', 'POST', { fileId: resultId.current }, controller.signal);
      if (version !== generation.current) return;
      const href = safeTransferUrl(grant.url);
      if (!href || typeof grant.expiresIn !== 'number' || grant.expiresIn <= 0) throw new Error('The download is unavailable or expired. Convert the document again.');
      const anchor = document.createElement('a');
      anchor.href = href; anchor.rel = 'noopener noreferrer'; anchor.referrerPolicy = 'no-referrer';
      anchor.download = tool.slug + '-result.' + tool.output; anchor.click();
    } catch (error) {
      if (version === generation.current) {
        if (isExpired(error)) { job.current = null; resultId.current = null; setExpired(); }
        else setDownloadError(error instanceof Error ? error.message : 'The download is unavailable or expired. Convert the document again.');
      }
    } finally { if (version === generation.current) request.current = null; }
  }

  const sourceBytes = state.files[0]?.file.size || 0, outputBytes = state.resultFiles[0]?.size || 0;
  const maximumMiB = tool.maxFileMiB ?? (tool.ocr ? 10 : tool.extension === 'html' ? 2 : 25);
  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="space-y-3 rounded-3xl border border-border-subtle bg-surface p-6"><PrivacyBadge mode="server" /><h1 className="text-2xl font-bold">{tool.title}</h1><p>{tool.description}</p><p className="text-sm text-text-muted">Selecting a file does not upload it. Upload and convert sends it to temporary server storage. One file at a time; {maximumMiB} MiB maximum.</p></div>
    {(state.status === 'idle' || state.status === 'ready') && <UniversalUploader key={uploaderKey} allowedExtensions={tool.inputExtensions || [tool.extension]} accept={(tool.inputExtensions || [tool.extension]).map(extension => '.' + extension).join(',')} multiple={false} maxBatchCount={1} maxFileBytes={maximumMiB * 1024 * 1024} onFilesChange={setFiles} privacyLabel="Uploaded only after you choose Upload and convert; temporary server processing" />}
    {tool.ocr && (state.status === 'idle' || state.status === 'ready') && <fieldset className="space-y-4 rounded-2xl border border-border-subtle p-5"><legend className="px-2 font-semibold">OCR options</legend><label className="block">Recognition language<select aria-describedby="ocr-language-help" className="ml-3 rounded border border-border-subtle bg-surface p-2" defaultValue="eng"><option value="eng">English</option></select></label><p id="ocr-language-help" className="text-sm text-text-muted">English is the only installed and tested recognition language.</p><label className="flex items-center gap-3"><input type="checkbox" checked={cleanup} onChange={event => setCleanup(event.target.checked)} />Deskew and clean up the scan</label><p className="text-sm text-text-muted">Cleanup can alter contrast, orientation and fine details. Turn it off to reduce changes to the original scan.</p></fieldset>}
    <ConverterStateView state={state} onConvert={convert} onCancel={stop} onReset={clear} onDownloadSingle={download} actionLabel="Upload and convert" />
    {uploadProgress !== null && state.status === 'processing' && <div className="mx-auto max-w-4xl space-y-2 rounded-2xl border border-border-subtle bg-surface p-4" aria-label="Upload progress">
      <div className="flex justify-between gap-3 text-sm"><label htmlFor="server-upload-progress">Uploading file</label><span>{uploadProgress}%</span></div>
      <progress id="server-upload-progress" className="h-2 w-full accent-primary" max={100} value={uploadProgress} aria-valuetext={`${uploadProgress}% uploaded`} />
    </div>}
    {state.status === 'complete' && <p role="status" className="text-sm">{tool.slug === 'compress-pdf' ? `Original: ${sourceBytes.toLocaleString()} bytes. Output: ${outputBytes.toLocaleString()} bytes. ${outputBytes < sourceBytes ? `Size reduced by ${(sourceBytes - outputBytes).toLocaleString()} bytes.` : 'No size reduction: the output is the same size or larger.'}` : 'Your validated result is ready to download.'} Outputs expire one hour after completion.</p>}
    {downloadError && <p role="alert" className="text-red-700">{downloadError}</p>}
  </div>;
}
