'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UniversalUploader, type ValidatedFile } from '@/components/uploader';
import { useConverterState } from '../useConverterState';
import { ConverterStateView } from '../ConverterStateView';
import { PrivacyBadge } from '@/components/tools/PrivacyBadge';
import { PDF_LIMITS, type PdfInfo, type PdfOptions, type PdfOutput, type PdfToolMode } from '@/lib/converters/pdf/types';
import { parsePages } from '@/lib/converters/pdf/pages';
import type { ConvertedImageResult } from '@/lib/converters/image/types';

const button = 'min-h-11 rounded-xl border border-border-subtle px-4 py-2 text-sm font-semibold text-text-strong focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40';
const primaryButton = `${button} bg-primary text-white`;
const secondaryButton = `${button} bg-surface`;
const input = 'mt-1 w-full min-h-11 rounded-xl border border-border-subtle bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary';

export function PdfConverterClient({ mode, title, description }: { mode: PdfToolMode; title: string; description: string }) {
  const { state, setFiles, startValidating, setReady, startProcessing, setComplete, setFailed, cancel, reset } = useConverterState();
  const [uploaderKey, setUploaderKey] = useState(0);
  const [info, setInfo] = useState<PdfInfo[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [range, setRange] = useState('');
  const [splitMode, setSplitMode] = useState('each');
  const [angle, setAngle] = useState(90);
  const [text, setText] = useState('DRAFT');
  const [opacity, setOpacity] = useState(0.25);
  const [start, setStart] = useState(1);
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const [dpi, setDpi] = useState(144);
  const [quality, setQuality] = useState(0.85);
  const [optionError, setOptionError] = useState('');
  const [zipping, setZipping] = useState(false);
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  const results = useRef<ConvertedImageResult[]>([]), zipUrl = useRef<string | null>(null);
  const cleanup = useCallback(() => {
    generation.current++;
    controller.current?.abort(); controller.current = null;
    results.current.forEach(result => URL.revokeObjectURL(result.blobUrl)); results.current = [];
    if (zipUrl.current) URL.revokeObjectURL(zipUrl.current); zipUrl.current = null;
  }, []);
  useEffect(() => cleanup, [cleanup]);
  const receiveFiles = useCallback((files: ValidatedFile[]) => {
    cleanup(); setInfo([]); setSelection([]); setOrder([]); setOptionError(''); setZipping(false); setFiles(files);
  }, [cleanup, setFiles]);
  const resetAll = () => { cleanup(); setInfo([]); setOptionError(''); setZipping(false); setUploaderKey(key => key + 1); reset(); };
  const stop = () => { cleanup(); cancel(); };
  const busy = state.status === 'validating' || state.status === 'processing';
  const files = state.files.filter(file => file.status === 'valid').map(file => file.file);
  const imageOutput = mode === 'jpg' || mode === 'png';
  const selectable = ['extract', 'delete', 'rotate', 'jpg', 'png'].includes(mode);

  const inspect = async () => {
    cleanup(); const run = generation.current;
    const abort = new AbortController(); controller.current = abort;
    startValidating();
    try {
      const { runPdfWorker } = await import('@/lib/converters/pdf/client');
      const response = await runPdfWorker({ action: 'inspect', files }, abort.signal);
      if (run !== generation.current) return;
      const summaries = response.info!;
      setInfo(summaries); setOrder(summaries[0].pages.map((_, index) => index));
      setSelection(mode === 'delete' ? [] : summaries[0].pages.map((_, index) => index));
      setRange(''); setReady();
    } catch (error) { if (run === generation.current) setFailed('CORRUPT_FILE', error instanceof Error ? error.message : 'Unable to inspect PDF.'); }
  };

  const convert = async () => {
    setOptionError('');
    let options: PdfOptions | undefined;
    try {
      if (selectable && !selection.length) throw new Error('Select at least one page.');
      if (!imageOutput) {
        options = { operation: mode, pages: mode === 'organize' ? order : selectable ? selection : undefined, angle, text, opacity, startNumber: start, position };
        if (mode === 'split' && splitMode === 'ranges') options.groups = range.split(';').map(group => parsePages(group, info[0].pages.length));
      }
    } catch (error) { setOptionError((error as Error).message); return; }
    cleanup(); const run = generation.current;
    const abort = new AbortController(); controller.current = abort;
    startProcessing(imageOutput ? 'Rendering PDF pages on this device…' : 'Processing PDF pages on this device…');
    try {
      let outputs: PdfOutput[];
      if (imageOutput) {
        const { renderPdfPages } = await import('@/lib/converters/pdf/render');
        outputs = await renderPdfPages(files[0], selection, mode, dpi, quality, abort.signal, (done, total) => { if (run === generation.current) startProcessing(`Rendered ${done} of ${total} pages`); });
      } else {
        const { runPdfWorker } = await import('@/lib/converters/pdf/client');
        outputs = (await runPdfWorker({ action: 'convert', files, options: options! }, abort.signal)).outputs!;
      }
      if (run !== generation.current) return;
      const converted: ConvertedImageResult[] = [];
      try {
        for (const output of outputs) {
          const blob = new Blob([output.bytes], { type: output.mimeType });
          converted.push({ name: output.name, blob, blobUrl: URL.createObjectURL(blob), size: blob.size, mimeType: output.mimeType, originalName: files[0].name, originalSize: files.reduce((sum, file) => sum + file.size, 0) });
        }
      } catch (error) { converted.forEach(result => URL.revokeObjectURL(result.blobUrl)); throw error; }
      results.current = converted;
      setComplete(converted.map(({ name, size, mimeType, blobUrl }) => ({ name, size, mimeType, blobUrl })));
    } catch (error) { if (run === generation.current) setFailed('CORRUPT_FILE', error instanceof Error ? error.message : 'Unable to process PDF.'); }
  };

  const downloadZip = async () => {
    if (zipping) return;
    setZipping(true); setOptionError(''); const run = generation.current;
    try {
      const { createBatchZip } = await import('@/lib/converters/image/batch');
      const zip = await createBatchZip(results.current, `filenimble-${mode}.zip`);
      if (run !== generation.current) { URL.revokeObjectURL(zip.url); return; }
      if (zipUrl.current) URL.revokeObjectURL(zipUrl.current); zipUrl.current = zip.url;
      const link = document.createElement('a'); link.href = zip.url; link.download = zip.filename;
      document.body.appendChild(link); link.click(); link.remove();
    } catch { if (run === generation.current) setOptionError('ZIP creation failed. Download the files individually.'); }
    finally { if (run === generation.current) setZipping(false); }
  };

  const move = (index: number, step: number) => {
    const next = [...order]; [next[index], next[index + step]] = [next[index + step], next[index]]; setOrder(next);
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="rounded-3xl border border-border-subtle bg-surface p-6 sm:p-8">
      <PrivacyBadge mode="client" />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-text-muted">{description}</p>
    </div>
    <p className="text-sm text-text-muted">PDFs stay on this device. Up to 25 MiB per file, 50 MiB and 200 pages total. {mode === 'merge' ? 'Merge 2–10 files in the order shown.' : 'One PDF at a time.'} Encrypted PDFs, interactive forms, signatures, portfolios, embedded files and scripts are unsupported.</p>
    {imageOutput && <p className="text-sm text-text-muted">Export up to 40 pages, 8 megapixels per page and 64 megapixels total. White background; annotations are excluded. Complex pages may exceed browser memory even within these limits.</p>}
    {state.status !== 'complete' && state.status !== 'cancelled' && state.status !== 'failed' && <UniversalUploader key={uploaderKey} title="Choose PDF files or drop them here" allowedExtensions={['pdf']} allowedMimeTypes={['application/pdf']} maxFileBytes={PDF_LIMITS.fileBytes} maxBatchCount={mode === 'merge' ? 10 : 1} multiple={mode === 'merge'} onFilesChange={receiveFiles} disabled={busy} />}
    {state.files.some(file => file.status !== 'valid') && <p role="alert" className="text-sm text-red-700">Remove or replace the invalid files shown above before reading PDF pages.</p>}
    {!busy && state.status === 'ready' && !info.length && <button className={primaryButton} disabled={files.length !== state.files.length || (mode === 'merge' && files.length < 2)} onClick={inspect}>Read PDF pages</button>}
    {info.length > 0 && state.status === 'ready' && <fieldset className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-5 min-w-0">
      <legend className="px-2 font-bold">PDF options</legend>
      <p role="status" className="break-words [overflow-wrap:anywhere]">{info.map(item => `${item.name}: ${item.pages.length} pages`).join(' • ')}</p>
      {mode === 'merge' && <p className="text-sm text-text-muted">Use the uploader’s Move up / Move down buttons to change document order, then read the pages again.</p>}
      {mode === 'split' && <><label className="block">Split method<select className={input} value={splitMode} onChange={event => setSplitMode(event.target.value)}><option value="each">One PDF per page (up to 100)</option><option value="ranges">Custom groups</option></select></label>{splitMode === 'ranges' && <label className="block">Page groups<input className={input} value={range} onChange={event => setRange(event.target.value)} placeholder="1-3; 4,6; 5" /><span className="text-xs text-text-muted">Separate output files with semicolons; commas/ranges select pages within a file. Pages can appear in different groups.</span></label>}</>}
      {selectable && <><p className="text-sm">{mode === 'delete' ? 'Selected pages will be deleted.' : mode === 'rotate' ? 'Selected pages will be rotated; all other pages stay unchanged.' : 'Choose the pages to include.'}</p>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondaryButton} onClick={() => setSelection(order)}>Select all</button><button type="button" className={secondaryButton} onClick={() => setSelection([])}>Clear selection</button></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="flex-1">Page range<input className={input} placeholder="1, 3-5" value={range} onChange={event => setRange(event.target.value)} /></label><button type="button" className={secondaryButton} onClick={() => { try { setSelection(parsePages(range, order.length)); setOptionError(''); } catch (error) { setOptionError((error as Error).message); } }}>Apply range</button></div>
      </>}
      {(selectable || mode === 'organize') && <ol aria-label="PDF pages" className="max-h-96 overflow-y-auto space-y-2 p-1">
        {order.map((page, index) => <li key={page} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle p-3">
          {selectable ? <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={selection.includes(page)} onChange={event => setSelection(current => event.target.checked ? [...current, page].sort((a,b) => a-b) : current.filter(value => value !== page))} aria-label={`Select page ${page + 1}`} className="h-5 w-5 accent-primary" /><span>Page {page + 1}</span></label> : <span>Position {index + 1}: Page {page + 1}</span>}
          <span className="text-xs text-text-muted">{Math.round(info[0].pages[page].width)} × {Math.round(info[0].pages[page].height)} pt · {info[0].pages[page].rotation}°</span>
          {mode === 'organize' && <div className="flex gap-2"><button className={secondaryButton} disabled={index === 0} aria-label={`Move page ${page + 1} up`} onClick={() => move(index, -1)}>↑</button><button className={secondaryButton} disabled={index === order.length - 1} aria-label={`Move page ${page + 1} down`} onClick={() => move(index, 1)}>↓</button></div>}
        </li>)}
      </ol>}
      {mode === 'rotate' && <label className="block">Clockwise rotation<select className={input} value={angle} onChange={event => setAngle(Number(event.target.value))}><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></select></label>}
      {mode === 'numbers' && <div className="grid gap-4 sm:grid-cols-2"><label>Starting number<input type="number" min={1} max={99999} className={input} value={start} onChange={event => setStart(Number(event.target.value))} /></label><label>Position<select className={input} value={position} onChange={event => setPosition(event.target.value as 'top' | 'bottom')}><option value="bottom">Bottom center</option><option value="top">Top center</option></select></label></div>}
      {mode === 'watermark' && <><label className="block">Watermark text<input className={input} maxLength={80} value={text} onChange={event => setText(event.target.value)} /></label><label className="block">Opacity: {Math.round(opacity * 100)}%<input aria-label="Watermark opacity" type="range" min={10} max={100} value={Math.round(opacity * 100)} onChange={event => setOpacity(Number(event.target.value) / 100)} className="block w-full min-h-11 accent-primary" /></label><p className="text-xs text-text-muted">Centered horizontal text, up to 80 printable English characters. A watermark is a visual label, not access protection or redaction.</p></>}
      {imageOutput && <><label className="block">Resolution<select className={input} value={dpi} onChange={event => setDpi(Number(event.target.value))}><option value={72}>72 DPI (smaller)</option><option value={144}>144 DPI (more detail)</option></select></label>{mode === 'jpg' && <label className="block">JPEG quality: {Math.round(quality * 100)}%<input type="range" min={10} max={100} step={5} aria-label="JPEG quality" className="block min-h-11 w-full accent-primary" value={Math.round(quality * 100)} onChange={event => setQuality(Number(event.target.value) / 100)} /></label>}</>}
      <button className={primaryButton} onClick={convert}>{imageOutput ? `Export ${mode.toUpperCase()} pages` : 'Create PDF results'}</button>
    </fieldset>}
    {optionError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{optionError}</p>}
    {zipping && <p role="status">Preparing ZIP on this device…</p>}
    {['validating', 'processing', 'complete', 'failed', 'cancelled'].includes(state.status) && <ConverterStateView state={state} onCancel={stop} onReset={resetAll} onDownloadAll={downloadZip} />}
    {state.status === 'validating' && <button className={secondaryButton} onClick={stop}>Cancel reading</button>}
  </div>;
}
