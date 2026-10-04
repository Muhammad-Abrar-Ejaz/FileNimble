import { afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { convertSingleImage } from './encoder';
import { runBatchConversion, createBatchZip } from './batch';
import { calculateResizeDimensions, clampCropBounds } from './transforms';
import type { ConvertedImageResult } from './types';
import { convertImagesToPdf } from './pdfEncoder';
import { decodeImage } from './decoder';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const png = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'image.png', { type: 'image/png' });
function result(name = 'image.png'): ConvertedImageResult {
  return { name, size: 3, blob: new Blob(['abc']), blobUrl: 'blob:test', mimeType: 'image/png', originalName: name, originalSize: 4 };
}
function mockCanvas(mode: 'null' | 'wrong-mime' | 'wrong-signature' | 'throw' | 'success' | 'context') {
  const close = vi.fn(), fillRect = vi.fn(), drawImage = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width:80, height:60, close }));
  const toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
    if (mode === 'throw') throw new Error('encoder failed');
    cb(mode === 'null' ? null : mode === 'wrong-mime' ? new Blob(['invalid'], {type:'image/png'}) : new Blob([mode === 'wrong-signature' ? new Uint8Array([0,0,0]) : new Uint8Array([255,216,255])], {type:'image/jpeg'}));
  });
  const ctx = { fillRect, drawImage, fillStyle: '' };
  const canvas = { width:0, height:0, getContext: () => mode === 'context' ? null : ctx, toBlob };
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
  return { canvas, close, ctx, toBlob };
}

describe('resource ownership and encoder failures', () => {
  for (const mode of ['null','wrong-mime','wrong-signature','throw','context'] as const) {
    it(`cleans bitmap and Canvas when ${mode}`, async () => {
      const {canvas,close} = mockCanvas(mode);
      await expect(convertSingleImage(png,png.name,{targetExtension:'jpg'})).rejects.toThrow();
      expect(close).toHaveBeenCalledOnce();
      expect([canvas.width,canvas.height]).toEqual([0,0]);
    });
  }
  it('forwards quality and paints background before image', async () => {
    const {ctx,toBlob,close} = mockCanvas('success');
    const output = await convertSingleImage(png,png.name,{targetExtension:'jpg',quality:0.3,backgroundColor:'#FF0000'});
    expect(ctx.fillStyle).toBe('#FF0000');
    expect(ctx.fillRect.mock.invocationCallOrder[0]).toBeLessThan(ctx.drawImage.mock.invocationCallOrder[0]);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function),'image/jpeg',0.3);
    expect(output.size).toBe(output.blob.size);
    expect(close).toHaveBeenCalledOnce(); URL.revokeObjectURL(output.blobUrl);
  });
  it('closes oversized decoded images before rendering', async () => {
    const close=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({width:10000,height:10000,close}));
    await expect(convertSingleImage(png,png.name,{})).rejects.toThrow(/megapixels/);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('batch ordering, limits and archives', () => {
  it('preserves duplicate-name input order despite out-of-order completion; caps concurrency at two', async () => {
    const files=Array.from({length:5}, (_,i)=>new File([`${i}`],'same.png'));
    let active=0, peak=0;
    const output=await runBatchConversion(files,{},async file=>{
      active++;peak=Math.max(peak,active);
      const index=Number(await file.text());
      await new Promise(resolve=>setTimeout(resolve,index===0?15:1));active--;
      if(index===2)throw new Error('bad image');
      return {...result('same.png'),size:index};
    },undefined,100);
    expect(peak).toBe(2);expect(output.successful.map(r=>r.size)).toEqual([0,1,3,4]);
    expect(output.failed[0].file).toBe(files[2]);
  });
  for(const concurrency of [0,-1,NaN]) it(`does not silently skip files at concurrency ${concurrency}`,async()=>{
    const output=await runBatchConversion([png],{},async()=>result(),undefined,concurrency);
    expect(output.successful).toHaveLength(1);
  });
  it('deduplicates against both original and generated ZIP names and strips paths',async()=>{
    const archive=await createBatchZip(['a.png','a.png','a-1.png','A.PNG','../../a.png'].map(name=>result(name)));
    const zip=await JSZip.loadAsync(await archive.blob.arrayBuffer());
    const names=Object.keys(zip.files);
    expect(names).toHaveLength(5);expect(new Set(names.map(n=>n.toLowerCase())).size).toBe(5);
    expect(names.every(n=>!n.includes('/'))).toBe(true);
    for(const file of Object.values(zip.files))expect(await file.async('text')).toBe('abc');
    URL.revokeObjectURL(archive.url);
  });
});

describe('dimension validation',()=>{
  it('requires opt-in for enlarging',()=>{
    expect(calculateResizeDimensions(80,60,{width:160})).toEqual({width:80,height:60});
    expect(calculateResizeDimensions(80,60,{width:160,allowUpscale:true})).toEqual({width:160,height:120});
  });
  for(const width of [-1,0,NaN,Infinity,20000])it(`rejects invalid width ${width}`,()=>{
    expect(()=>calculateResizeDimensions(80,60,{width})).toThrow();
  });
  it('rejects non-finite crops',()=>expect(()=>clampCropBounds(80,60,{x:NaN,y:0,width:10,height:10})).toThrow());
});

describe('PDF validation and cleanup', () => {
  it('rejects invalid margins before decoding', async () => {
    await expect(convertImagesToPdf([png], { margin: -1 })).rejects.toThrow(/margins/);
    await expect(convertImagesToPdf([png], { margin: NaN })).rejects.toThrow(/margins/);
  });
  it('cleans resources when PDF normalization fails', async () => {
    const {canvas, close} = mockCanvas('null');
    const jpeg = new File([new Uint8Array([255,216,255])], 'photo.jpg');
    await expect(convertImagesToPdf([jpeg])).rejects.toThrow(/encode/);
    expect(close).toHaveBeenCalledOnce(); expect([canvas.width,canvas.height]).toEqual([0,0]);
  });
});

describe('HTML image fallback', () => {
  for (const success of [true,false]) it(`releases fallback URL on ${success ? 'close' : 'decode failure'}`,async()=>{
    vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('bitmap unavailable')));
    const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
    vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:fallback');
    vi.stubGlobal('Image',class {
      naturalWidth=80;naturalHeight=60;
      onload: (()=>void)|null=null;onerror:(()=>void)|null=null;
      set src(value:string) { if(value)queueMicrotask(()=>success?this.onload?.():this.onerror?.()); }
    });
    if(success){const image=await decodeImage(png);expect(image.width).toBe(80);image.close();image.close();}
    else await expect(decodeImage(png)).rejects.toThrow(/decode/);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:fallback');
  });
});
