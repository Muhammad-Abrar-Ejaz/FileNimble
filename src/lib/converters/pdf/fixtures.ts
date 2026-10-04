// Generated fixtures shared by tests only; no user documents or binary fixtures are stored.
import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';

export async function makePdf(widths = [200, 300, 400], options: { encrypted?: boolean; form?: boolean; script?: boolean; rotated?: boolean; cropped?: boolean; complex?: boolean } = {}): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const [index, width] of widths.entries()) {
    const page = doc.addPage([width, 240]);
    page.drawRectangle({ x: 0, y: 0, width, height: 240, color: index % 2 ? rgb(0, 0, 1) : rgb(1, 0, 0) });
    page.drawText(`PAGE ${index + 1}`, { x: 30, y: 120, font, size: 18, color: rgb(1, 1, 1) });
    if (options.complex) {
      for (let n = 0; n < 300; n++) page.drawLine({ start: {x:n % width,y:n%240}, end:{x:(n*17)%width,y:(n*31)%240}, color:rgb((n%7)/7,(n%11)/11,(n%13)/13), thickness:0.4 });
    }
    if (options.rotated) page.setRotation(degrees(90));
    if (options.cropped) page.setCropBox(10, 20, width - 20, 200);
  }
  if (options.form) doc.getForm().createTextField('fixture-field').addToPage(doc.getPage(0));
  if (options.script) doc.addJavaScript('fixture', 'app.alert("fixture");');
  // Synthetic Encrypt dictionary tests rejection; it is never decrypted or treated as usable content.
  if (options.encrypted) doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({ Filter: PDFName.of('Standard'), V: 1, R: 2, Length: 40 }));
  return new Uint8Array(await doc.save({ useObjectStreams: !options.encrypted }));
}
