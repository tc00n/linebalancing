/** A4 quer in Punkt (1/72 Zoll). */
export const A4_LANDSCAPE = { width: 842, height: 595 } as const;

/** zlib-Komprimierung für /FlateDecode; im Browser und in Node verfügbar. */
export async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Titel als UTF-16BE-Hexstring, damit Umlaute im PDF-Dokumentinfo korrekt sind. */
function pdfText(value: string): string {
  let hex = "FEFF";
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    const units =
      code > 0xffff
        ? [
            0xd800 + ((code - 0x10000) >> 10),
            0xdc00 + ((code - 0x10000) & 0x3ff),
          ]
        : [code];
    for (const u of units) hex += u.toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

/**
 * Einseitiges PDF mit einem verlustfreien RGB-Bild (E18): A4 quer, auf die Breite skaliert und
 * höchstens so hoch wie die Seite, oben links mit Rand. Ohne Fremdbibliothek.
 */
export function imagePdf(options: {
  readonly imageWidth: number;
  readonly imageHeight: number;
  /** RGB, 8 Bit je Kanal, zeilenweise, mit deflate komprimiert. */
  readonly deflatedRgb: Uint8Array;
  readonly title: string;
  readonly margin?: number;
}): Uint8Array {
  const { width: pw, height: ph } = A4_LANDSCAPE;
  const margin = options.margin ?? 24;
  const scale = Math.min(
    (pw - 2 * margin) / options.imageWidth,
    (ph - 2 * margin) / options.imageHeight,
  );
  const w = +(options.imageWidth * scale).toFixed(2);
  const h = +(options.imageHeight * scale).toFixed(2);
  const content = `q ${w} 0 0 ${h} ${margin} ${+(ph - margin - h).toFixed(2)} cm /Im0 Do Q`;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}\n`);
    if (stream) {
      push("stream\n");
      push(stream);
      push("\nendstream\n");
    }
    push("endobj\n");
  };

  // Kommentar mit Bytes über 127 kennzeichnet die Datei als binär.
  push("%PDF-1.4\n%âãÏÓ\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  object(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${options.imageWidth} /Height ${options.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${options.deflatedRgb.length} >>`,
    options.deflatedRgb,
  );
  const contentBytes = encoder.encode(content);
  object(5, `<< /Length ${contentBytes.length} >>`, contentBytes);
  object(
    6,
    `<< /Title ${pdfText(options.title)} /Producer (NEONEX Line Balancing) >>`,
  );

  const xref = length;
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let id = 1; id <= 6; id++)
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(
    `trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
