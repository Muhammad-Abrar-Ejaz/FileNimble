'use client';

import { useEffect, useRef, useState } from 'react';
import { AI_TEXT_LIMITS, extractPdfText } from '@/lib/ai/pdfText';
import type { AiToolPageConfig } from '@/config/aiTools';

const languages = ['Arabic', 'Chinese', 'English', 'French', 'German', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Portuguese', 'Russian', 'Spanish', 'Turkish', 'Urdu'];

export function AiToolClient({ tool }: { tool: AiToolPageConfig }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [providerName, setProviderName] = useState('');
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('English');
  const [consented, setConsented] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [working, setWorking] = useState(false);
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const request = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/ai/status', { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(status => { setEnabled(status.enabled === true); setProviderName(status.enabled && status.provider === 'openai' ? 'OpenAI' : ''); })
      .catch(() => setEnabled(false));
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  async function selectPdf(file?: File) {
    setError(''); setResult(''); setPages(null); setConsented(false); setText('');
    if (!file) return;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller; setExtracting(true);
    try {
      const extracted = await extractPdfText(file, controller.signal);
      setText(extracted.text); setPages(extracted.pages);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'PDF text extraction failed.');
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (pdfInputRef.current?.files?.[0] === file) pdfInputRef.current.value = '';
        setExtracting(false);
      }
    }
  }

  async function process() {
    if (!consented || !text.trim() || !enabled || text.length > AI_TEXT_LIMITS.characters || (tool.slug === 'pdf-to-structured-markdown' && pages === null)) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setWorking(true); setError(''); setResult(''); setCopied(false);
    try {
      const response = await fetch('/api/v1/ai/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({ tool: tool.slug, text, ...(tool.slug === 'translate-document' ? { language } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.message === 'string' ? payload.message : 'AI processing could not be completed.');
      if (typeof payload.result !== 'string' || !payload.result.trim() || payload.result.length > 24_000) throw new Error('The AI result did not pass validation.');
      setResult(payload.result); requestAnimationFrame(() => resultRef.current?.focus());
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'AI processing could not be completed.');
    } finally { if (request.current === controller) request.current = null; setWorking(false); }
  }

  function clear() {
    request.current?.abort(); request.current = null; if (pdfInputRef.current) pdfInputRef.current.value = ''; setText(''); setPages(null); setConsented(false); setError(''); setResult(''); setCopied(false); setWorking(false); setExtracting(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(result); setCopied(true); }
    catch { setError('Copy is unavailable in this browser. Select the result text and copy it.'); }
  }

  function download() {
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = tool.outputName; anchor.rel = 'noreferrer'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return <div className="mx-auto max-w-4xl space-y-6">
    <section className="space-y-3 rounded-3xl border border-border-subtle bg-surface p-6">
      <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-950">AI processing · external provider</span>
      <h1 className="text-2xl font-bold">{tool.title}</h1>
      <p>{tool.description}</p>
      <p className="text-sm text-text-muted">{tool.details}</p>
    </section>

    <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-6" aria-label="AI document input">
      {tool.acceptsPdf && <div className="space-y-2">
        <label htmlFor="ai-pdf" className="block font-semibold">Select a PDF (optional unless this tool requires one)</label>
        <input ref={pdfInputRef} id="ai-pdf" type="file" accept=".pdf,application/pdf" disabled={working || extracting} onChange={event => void selectPdf(event.currentTarget.files?.[0])} className="block w-full rounded-xl border border-border-subtle p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
        <p className="text-sm text-text-muted">PDF bytes stay in this browser. Text extraction is local; file names and PDF bytes are never sent to the AI endpoint.</p>
      </div>}
      {tool.pastedText && <label htmlFor="ai-text" className="block font-semibold">Document text</label>}
      <textarea id="ai-text" aria-label="Document text" value={text} onChange={event => { setText(event.target.value); setPages(null); setConsented(false); setResult(''); setError(''); }} readOnly={extracting || working || (tool.slug === 'pdf-to-structured-markdown' && pages !== null)} maxLength={AI_TEXT_LIMITS.characters} rows={12} placeholder={tool.pastedText ? 'Paste document text here, or select a PDF above…' : 'Select a PDF to extract its selectable text locally…'} className="block w-full rounded-xl border border-border-subtle bg-canvas p-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70" aria-describedby="ai-limit ai-page-status" />
      <div className="flex flex-wrap justify-between gap-2 text-sm text-text-muted"><span id="ai-page-status" role="status">{extracting ? 'Extracting PDF text locally…' : pages === null ? 'No PDF selected.' : `Extracted text from ${pages} PDF page${pages === 1 ? '' : 's'} locally.`}</span><span id="ai-limit">{text.length.toLocaleString()} / {AI_TEXT_LIMITS.characters.toLocaleString()} characters</span></div>
      {tool.slug === 'translate-document' && <label className="block max-w-sm font-semibold">Translate into<select value={language} onChange={event => setLanguage(event.target.value)} className="mt-2 block w-full rounded-lg border border-border-subtle bg-surface p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{languages.map(value => <option key={value}>{value}</option>)}</select></label>}

      <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <h2 className="font-bold">Before you use AI processing</h2>
        <p>When you choose the action below, the text in this box is sent to FileNimble’s backend and then to its configured external AI provider{providerName ? ` (${providerName})` : ''}. The original PDF, filename, account data, job IDs and credentials are not sent. FileNimble does not save the submitted text in jobs, storage, or logs; the provider handles it under its own terms and retention policy. Do not submit sensitive or confidential text.</p>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 accent-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" checked={consented} onChange={event => setConsented(event.target.checked)} disabled={working} /><span>I understand that my text will be sent to the configured external AI provider for this request.</span></label>
      </div>
      {enabled === false && <p role="status" className="rounded-lg bg-surface-muted p-3 text-sm">AI processing is currently disabled because this server has no active provider configuration. Existing FileNimble converters remain available.</p>}
      {enabled === null && <p role="status" className="text-sm text-text-muted">Checking AI service availability…</p>}
      {working && <p role="status" aria-live="polite" className="text-sm text-text-muted">Sending only the submitted text to the configured AI provider…</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void process()} disabled={!enabled || working || extracting || !consented || !text.trim() || text.length > AI_TEXT_LIMITS.characters || (tool.slug === 'pdf-to-structured-markdown' && pages === null)} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{working ? 'Processing…' : tool.action}</button>
        {(working || extracting) && <button type="button" onClick={() => request.current?.abort()} className="rounded-xl border border-border-subtle px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Cancel</button>}
        {(text || result || error) && <button type="button" onClick={clear} className="rounded-xl border border-border-subtle px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Clear</button>}
      </div>
    </section>

    <section>
      <h2 className="mb-3 text-xl font-bold">How it works</h2><ol className="list-decimal space-y-2 pl-6">{tool.steps.map(step => <li key={step}>{step}</li>)}</ol>
    </section>
    {result && <section aria-labelledby="ai-result-title" className="space-y-3 rounded-2xl border border-border-subtle bg-surface p-6">
      <h2 id="ai-result-title" className="text-xl font-bold">AI-generated result — review before use</h2>
      <div ref={resultRef} tabIndex={-1} role="region" aria-label="Generated result text" className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-4 font-mono text-sm focus-visible:outline-2 focus-visible:outline-primary">{result}</div>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void copy()} className="rounded-xl border border-border-subtle px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{copied ? 'Copied' : 'Copy result'}</button><button type="button" onClick={download} className="rounded-xl border border-border-subtle px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Download text</button><span role="status" className="self-center text-sm text-text-muted">AI-generated content can be inaccurate; compare it with the source.</span></div>
    </section>}
  </div>;
}
