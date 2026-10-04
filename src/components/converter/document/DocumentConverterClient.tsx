'use client';

import { useEffect, useRef, useState } from 'react';
import type { DocumentTool } from '@/config/documentTools';
import { UniversalUploader } from '@/components/uploader/UniversalUploader';
import { PrivacyBadge } from '@/components/tools/PrivacyBadge';
import { ConverterStateView } from '../ConverterStateView';
import { useConverterState } from '../useConverterState';

async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch('/api/v1/' + path, { method, headers: { 'Content-Type': 'application/json', ...(path === 'jobs' ? { 'Idempotency-Key': crypto.randomUUID() } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Server processing is unavailable.');
  return result;
}

export function DocumentConverterClient({ tool }: { tool: DocumentTool }) {
  const [cleanup, setCleanup] = useState(true);
  const { state, setFiles, startProcessing, setComplete, setFailed, cancel, reset } = useConverterState();
  const generation = useRef(0), job = useRef<string | null>(null), transfer = useRef<AbortController | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0), [downloadError, setDownloadError] = useState('');
  const resultId = useRef<string | null>(null);

  useEffect(() => () => {
    generation.current++; transfer.current?.abort();
    if (job.current) void api('jobs/' + job.current, 'DELETE').catch(() => {});
  }, []);

  function clear() {
    generation.current++; transfer.current?.abort();
    if (job.current) void api('jobs/' + job.current, 'DELETE').catch(() => {});
    job.current = null; resultId.current = null; setDownloadError(''); reset(); setUploaderKey(value => value + 1);
  }

  async function convert() {
    const file = state.files.find(item => item.status === 'valid')?.file;
    if (!file) return;
    const version = ++generation.current;
    startProcessing('Creating a temporary server job…');
    try {
      const created = await api('jobs', 'POST', { tool: tool.slug, files: [{ name: file.name, size: file.size, type: file.type }], ...(tool.ocr ? { options: { language: 'eng', cleanup } } : {}) });
      if (version !== generation.current) { void api('jobs/' + created.jobId, 'DELETE').catch(() => {}); return; }
      job.current = created.jobId;
      const controller = new AbortController(); transfer.current = controller;
      startProcessing('Uploading to temporary private storage…');
      const grant = created.uploads[0];
      const uploaded = await fetch(grant.url, { method: 'PUT', headers: grant.headers, body: file, signal: controller.signal, credentials: 'omit' });
      if (!uploaded.ok) throw new Error('The upload failed. Clear the file and try again.');
      if (version !== generation.current) return;
      await api('jobs/' + created.jobId + '/complete-upload', 'POST');
      const deadline = Date.now() + 180000;
      while (version === generation.current && Date.now() < deadline) {
        const status = await api('jobs/' + created.jobId);
        if (version !== generation.current) return;
        if (status.state === 'COMPLETED') {
          const output = status.files[0]; resultId.current = output.fileId;
          setComplete([{ name: tool.slug + '-result.' + tool.output, size: output.bytes, mimeType: output.mediaType }]);
          return;
        }
        if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(status.state)) throw new Error('The document could not be converted within the supported format and resource limits. Check the supported formats, codecs and limits below; no result is available.');
        startProcessing(status.state === 'QUEUED' ? 'Waiting for an isolated conversion worker…' : 'Validating and converting your document…');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (version === generation.current) throw new Error('Processing took too long. Clear the file to remove this job and try a smaller document.');
    } catch (error) {
      if (version === generation.current) setFailed('CORRUPT_FILE', error instanceof Error ? error.message : 'Conversion failed.');
    }
  }

  function stop() {
    generation.current++; transfer.current?.abort();
    if (job.current) void api('jobs/' + job.current + '/cancel', 'POST').catch(() => setDownloadError('Cancellation could not be confirmed. Clear the file to request deletion.'));
    cancel();
  }

  async function download() {
    if (!job.current || !resultId.current) return;
    const version = generation.current;
    setDownloadError('');
    try {
      const grant = await api('jobs/' + job.current + '/download-token', 'POST', { fileId: resultId.current });
      if (version !== generation.current) return;
      const anchor = document.createElement('a'); anchor.href = grant.url; anchor.rel = 'noreferrer'; anchor.download = tool.slug + '-result.' + tool.output; anchor.click();
    } catch { if (version === generation.current) setDownloadError('The download is unavailable or expired. Convert the document again.'); }
  }

  const sourceBytes = state.files[0]?.file.size || 0, outputBytes = state.resultFiles[0]?.size || 0;
  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="space-y-3 rounded-3xl border border-border-subtle bg-surface p-6"><PrivacyBadge mode="server" /><h1 className="text-2xl font-bold">{tool.title}</h1><p>{tool.description}</p><p className="text-sm text-text-muted">Selecting a file does not upload it. Upload and convert sends it to temporary server storage. One file at a time; {tool.maxFileMiB ?? (tool.ocr ? 10 : tool.extension === 'html' ? 2 : 25)} MiB maximum.</p></div>
    {(state.status === 'idle' || state.status === 'ready') && <UniversalUploader key={uploaderKey} allowedExtensions={tool.inputExtensions || [tool.extension]} accept={(tool.inputExtensions || [tool.extension]).map(extension => '.' + extension).join(',')} multiple={false} maxBatchCount={1} maxFileBytes={(tool.maxFileMiB ?? (tool.ocr ? 10 : tool.extension === 'html' ? 2 : 25)) * 1024 * 1024} onFilesChange={setFiles} privacyLabel="Uploaded only after you choose Upload and convert; temporary server processing" />}
    {tool.ocr && (state.status === 'idle' || state.status === 'ready') && <fieldset className="space-y-4 rounded-2xl border border-border-subtle p-5"><legend className="px-2 font-semibold">OCR options</legend><label className="block">Recognition language<select aria-describedby="ocr-language-help" className="ml-3 rounded border border-border-subtle bg-surface p-2" defaultValue="eng"><option value="eng">English</option></select></label><p id="ocr-language-help" className="text-sm text-text-muted">English is the only installed and tested recognition language.</p><label className="flex items-center gap-3"><input type="checkbox" checked={cleanup} onChange={event => setCleanup(event.target.checked)} />Deskew and clean up the scan</label><p className="text-sm text-text-muted">Cleanup can alter contrast, orientation and fine details. Turn it off to reduce changes to the original scan.</p></fieldset>}
    <ConverterStateView state={state} onConvert={convert} onCancel={stop} onReset={clear} onDownloadSingle={download} actionLabel="Upload and convert" />
    {state.status === 'complete' && <p role="status" className="text-sm">{tool.slug === 'compress-pdf' ? `Original: ${sourceBytes.toLocaleString()} bytes. Output: ${outputBytes.toLocaleString()} bytes. ${outputBytes < sourceBytes ? `Size reduced by ${(sourceBytes - outputBytes).toLocaleString()} bytes.` : 'No size reduction: the output is the same size or larger.'}` : 'Your validated result is ready to download.'} Outputs expire one hour after completion.</p>}
    {downloadError && <p role="alert" className="text-red-700">{downloadError}</p>}
  </div>;
}
