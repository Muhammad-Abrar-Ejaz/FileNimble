import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPdfWorker } from './client';
import { PDF_LIMITS } from './types';

class FakeWorker {
  static current: FakeWorker;
  onmessage: ((event: {data: unknown}) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { FakeWorker.current = this; }
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('PDF worker ownership',()=>{
  it('terminates the worker after successful results',async()=>{
    vi.stubGlobal('Worker',FakeWorker);
    const pending=runPdfWorker({action:'inspect',files:[]},new AbortController().signal);
    FakeWorker.current.onmessage!({data:{ok:true,info:[]}});
    await expect(pending).resolves.toEqual({ok:true,info:[]});
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
  });
  it('terminates on cancellation and rejects late work',async()=>{
    vi.stubGlobal('Worker',FakeWorker);const controller=new AbortController();
    const pending=runPdfWorker({action:'inspect',files:[]},controller.signal);
    const rejected=expect(pending).rejects.toMatchObject({name:'AbortError'});
    controller.abort();await rejected;
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
  });
  it('terminates a worker that exceeds the time limit',async()=>{
    vi.useFakeTimers();vi.stubGlobal('Worker',FakeWorker);
    const pending=runPdfWorker({action:'inspect',files:[]},new AbortController().signal);
    const rejected=expect(pending).rejects.toThrow(/30 seconds/);
    await vi.advanceTimersByTimeAsync(PDF_LIMITS.workerMs);await rejected;
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
  });
  it('terminates on worker errors',async()=>{
    vi.stubGlobal('Worker',FakeWorker);
    const pending=runPdfWorker({action:'inspect',files:[]},new AbortController().signal);
    FakeWorker.current.onerror!();await expect(pending).rejects.toThrow(/worker could not run/);
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
  });
});
