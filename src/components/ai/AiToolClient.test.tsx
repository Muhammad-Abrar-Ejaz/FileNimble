// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AI_TOOLS } from '@/config/aiTools';
import { AiToolClient } from './AiToolClient';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('AI tool disclosure and results', () => {
  it('keeps the action disabled until the service is configured and disclosure is accepted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ enabled: false }))));
    render(<AiToolClient tool={AI_TOOLS['ai-document-summarizer']} />);
    await waitFor(() => expect(screen.getByText(/currently disabled/)).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Document text'), { target: { value: 'A short project report.' } });
    fireEvent.click(screen.getByLabelText(/sent to the configured external AI provider/));
    expect(screen.getByRole('button', { name: 'Summarize text' }).hasAttribute('disabled')).toBe(true);
  });

  it('sends only bounded text after explicit consent and displays model output as escaped text', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: '<script>alert(1)</script>Summary', provider: 'openai' })));
    vi.stubGlobal('fetch', fetcher);
    render(<AiToolClient tool={AI_TOOLS['ai-document-summarizer']} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Summarize text' }).hasAttribute('disabled')).toBe(true));
    fireEvent.change(screen.getByLabelText('Document text'), { target: { value: 'Report body without private metadata.' } });
    fireEvent.click(screen.getByLabelText(/sent to the configured external AI provider/));
    fireEvent.click(screen.getByRole('button', { name: 'Summarize text' }));
    await screen.findByText('<script>alert(1)</script>Summary');
    const [url, options] = fetcher.mock.calls[1];
    expect(url).toBe('/api/v1/ai/process');
    expect(JSON.parse(options.body)).toEqual({ tool: 'ai-document-summarizer', text: 'Report body without private metadata.' });
    expect(options.body).not.toContain('private-fixture-name.pdf');
    expect(screen.getByRole('region', { name: 'Generated result text' }).textContent).toContain('<script>');
    expect(document.querySelector('#ai-result-title')?.textContent).toContain('review before use');
  });

  it('requires a target language and surfaces safe backend errors', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'The AI service is busy. Please try again later.' }), { status: 429 }));
    vi.stubGlobal('fetch', fetcher);
    render(<AiToolClient tool={AI_TOOLS['translate-document']} />);
    await waitFor(() => expect(screen.getByLabelText('Document text')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Document text'), { target: { value: 'Hello there.' } });
    fireEvent.click(screen.getByLabelText(/sent to the configured external AI provider/));
    fireEvent.click(screen.getByRole('button', { name: 'Translate text' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/AI service is busy/);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ tool: 'translate-document', text: 'Hello there.', language: 'English' });
  });

  it('aborts an in-flight provider request when the user cancels', async () => {
    let providerSignal: AbortSignal | undefined;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true })))
      .mockImplementationOnce((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
        providerSignal = options.signal as AbortSignal;
        providerSignal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }));
    vi.stubGlobal('fetch', fetcher);
    render(<AiToolClient tool={AI_TOOLS['ai-document-summarizer']} />);
    await waitFor(() => expect(screen.getByLabelText('Document text')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Document text'), { target: { value: 'A summary source.' } });
    fireEvent.click(screen.getByLabelText(/sent to the configured external AI provider/));
    fireEvent.click(screen.getByRole('button', { name: 'Summarize text' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(providerSignal?.aborted).toBe(true));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
