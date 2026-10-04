import { inspectPdfs, convertPdfs } from './engine';
import type { PdfRequest, PdfResponse } from './types';

self.onmessage = async (event: MessageEvent<PdfRequest>) => {
  try {
    const request = event.data;
    const response: PdfResponse = request.action === 'inspect'
      ? { ok: true, info: await inspectPdfs(request.files) }
      : { ok: true, outputs: await convertPdfs(request.files, request.options) };
    self.postMessage(response, { transfer: response.outputs?.map(output => output.bytes.buffer) ?? [] });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Unable to process this PDF.' } satisfies PdfResponse);
  }
};
