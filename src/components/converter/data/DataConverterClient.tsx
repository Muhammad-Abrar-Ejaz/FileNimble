'use client';

import React, { useState, useId } from 'react';
import { DataToolConfig } from '@/config/dataTools';
import { UniversalUploader } from '@/components/uploader/UniversalUploader';
import { PrivacyBadge } from '@/components/tools/PrivacyBadge';
import {
  csvToJson,
  jsonToCsv,
  jsonToYaml,
  yamlToJson,
  jsonToXml,
  xmlToJson,
  markdownToHtml,
  htmlToMarkdown,
  csvToTsv,
  tsvToCsv,
  htmlTableToCsv,
  xmlToCsv,
} from '@/lib/converters/data';
import {
  FileText,
  Copy,
  Check,
  Download,
  RotateCcw,
  Sparkles,
  AlertCircle,
  FileCode,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  tool: DataToolConfig;
}

export function DataConverterClient({ tool }: Props) {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Common options
  const [csvDelimiter, setCsvDelimiter] = useState('auto');
  const [escapeFormulas, setEscapeFormulas] = useState(true);
  const [fullHtmlDoc, setFullHtmlDoc] = useState(true);
  const [xmlRootTag, setXmlRootTag] = useState('root');

  const delimiterId = useId();
  const rootTagId = useId();

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setError(null);
    try {
      const text = await file.text();
      setInputText(text);
      await performConversion(text);
    } catch (err) {
      setError(`Failed to read file: ${(err as Error).message}`);
    }
  };

  const performConversion = async (contentToConvert: string) => {
    if (!contentToConvert.trim()) {
      setError('Please provide content to convert.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let result = '';

      switch (tool.slug) {
        case 'csv-to-json': {
          const delim = csvDelimiter === 'auto' ? undefined : csvDelimiter;
          result = csvToJson(contentToConvert, { delimiter: delim });
          break;
        }
        case 'json-to-csv': {
          const delim = csvDelimiter === 'auto' ? ',' : csvDelimiter;
          result = jsonToCsv(contentToConvert, {
            delimiter: delim,
            escapeFormulas,
          });
          break;
        }
        case 'json-to-yaml':
          result = jsonToYaml(contentToConvert);
          break;
        case 'yaml-to-json':
          result = yamlToJson(contentToConvert);
          break;
        case 'json-to-xml':
          result = jsonToXml(contentToConvert, { rootTag: xmlRootTag || 'root' });
          break;
        case 'xml-to-json':
          result = xmlToJson(contentToConvert);
          break;
        case 'markdown-to-html':
          result = await markdownToHtml(contentToConvert, {
            fullDocument: fullHtmlDoc,
            title: selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'Document',
          });
          break;
        case 'html-to-markdown':
          result = htmlToMarkdown(contentToConvert);
          break;
        case 'csv-to-tsv':
          result = csvToTsv(contentToConvert, {
            delimiter: csvDelimiter === 'auto' ? undefined : csvDelimiter,
          });
          break;
        case 'tsv-to-csv':
          result = tsvToCsv(contentToConvert, {
            escapeFormulas,
          });
          break;
        case 'html-table-to-csv':
          result = htmlTableToCsv(contentToConvert, {
            escapeFormulas,
          });
          break;
        case 'xml-to-csv':
          result = xmlToCsv(contentToConvert, {
            escapeFormulas,
          });
          break;
        default:
          throw new Error(`Unsupported tool: ${tool.slug}`);
      }

      setOutputText(result);
    } catch (err) {
      setError((err as Error).message || 'Conversion failed.');
      setOutputText('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard.');
    }
  };

  const handleDownload = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: tool.outputMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile
      ? selectedFile.name.replace(/\.[^/.]+$/, `.${tool.outputFormat}`)
      : tool.outputFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setInputText('');
    setOutputText('');
    setError(null);
    setCopied(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header and Privacy */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-text-primary">
            {tool.title}
          </h1>
          <p className="mt-2 text-text-muted text-base">{tool.description}</p>
        </div>
        <div className="shrink-0">
          <PrivacyBadge mode="client" />
        </div>
      </div>

      {/* Main Conversion Card */}
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm">
        {/* Tab Selector */}
        <div className="flex border-b border-border-subtle bg-surface-muted/50 px-6 py-3">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'text'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface'
              }`}
            >
              Direct Text / Code
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {activeTab === 'upload' ? (
            <div>
              <UniversalUploader
                allowedExtensions={[tool.inputFormat]}
                allowedMimeTypes={[tool.inputMime, 'text/plain', 'application/octet-stream']}
                maxBatchCount={1}
                multiple={false}
                maxFileBytes={10 * 1024 * 1024}
                onFilesChange={validatedFiles => {
                  const rawFiles = validatedFiles.map(vf => vf.file);
                  handleFileSelected(rawFiles);
                }}
                title={`Drop your .${tool.inputFormat} file here`}
                subtitle="Up to 10 MiB. Converted privately in your browser."
              />
              {selectedFile && (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-border-subtle bg-surface-muted p-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium text-sm text-text-primary">{selectedFile.name}</p>
                      <p className="text-xs text-text-muted">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-text-muted hover:text-destructive flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Change file
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label htmlFor="input-content-area" className="block text-sm font-semibold text-text-primary">
                Input {tool.inputFormat.toUpperCase()} Content
              </label>
              <textarea
                id="input-content-area"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={`Paste your ${tool.inputFormat.toUpperCase()} data here...`}
                rows={8}
                className="w-full rounded-xl border border-border-subtle bg-surface-muted p-4 font-mono text-xs leading-relaxed text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isProcessing || !inputText.trim()}
                  onClick={() => performConversion(inputText)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {isProcessing ? 'Converting...' : `Convert to ${tool.outputFormat.toUpperCase()}`}
                </button>
              </div>
            </div>
          )}

          {/* Tool Options */}
          {(tool.slug === 'csv-to-json' || tool.slug === 'json-to-csv') && (
            <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-4 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Conversion Options
              </h2>
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-2">
                  <label htmlFor={delimiterId} className="text-sm font-medium text-text-primary">
                    Delimiter:
                  </label>
                  <select
                    id={delimiterId}
                    value={csvDelimiter}
                    onChange={e => {
                      setCsvDelimiter(e.target.value);
                      if (inputText) performConversion(inputText);
                    }}
                    className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="&#9;">Tab (\t)</option>
                    <option value="|">Pipe (|)</option>
                  </select>
                </div>

                {tool.slug === 'json-to-csv' && (
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={escapeFormulas}
                      onChange={e => {
                        setEscapeFormulas(e.target.checked);
                        if (inputText) performConversion(inputText);
                      }}
                      className="rounded border-border-subtle text-primary focus:ring-primary"
                    />
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Formula Injection Protection
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          {tool.slug === 'markdown-to-html' && (
            <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-4">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={fullHtmlDoc}
                  onChange={e => {
                    setFullHtmlDoc(e.target.checked);
                    if (inputText) performConversion(inputText);
                  }}
                  className="rounded border-border-subtle text-primary focus:ring-primary"
                />
                Generate complete HTML5 document with responsive styles
              </label>
            </div>
          )}

          {tool.slug === 'json-to-xml' && (
            <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-4 flex items-center gap-3">
              <label htmlFor={rootTagId} className="text-sm font-medium text-text-primary">
                Root Tag Name:
              </label>
              <input
                id={rootTagId}
                type="text"
                value={xmlRootTag}
                onChange={e => {
                  setXmlRootTag(e.target.value);
                  if (inputText) performConversion(inputText);
                }}
                className="w-32 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Converted Output View */}
          {outputText && (
            <div className="space-y-4 pt-4 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold text-sm text-text-primary">
                    Converted {tool.outputFormat.toUpperCase()} Output
                  </span>
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-text-muted">
                    {outputText.length} characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download File
                  </button>
                </div>
              </div>

              <div className="relative max-h-96 overflow-auto rounded-xl border border-border-subtle bg-surface-muted p-4">
                <pre className="font-mono text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-all">
                  {outputText}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
