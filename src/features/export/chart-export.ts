"use client";
import { downloadFile } from "@/lib/download";
import { chartSvg, type ChartExportInput } from "./chart-svg";
import { deflate, imagePdf } from "./pdf";

/** Zeichnet die SVG-Grafik in ein Canvas; `scale` erhöht die Auflösung für Druck und Beamer. */
async function rasterize(
  svg: string,
  width: number,
  height: number,
  scale: number,
) {
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Diagramm als PNG (E18), doppelte Auflösung. */
export async function downloadChartPng(
  input: ChartExportInput,
  filename: string,
) {
  const { svg, width, height } = chartSvg(input);
  const canvas = await rasterize(svg, width, height, 2);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(Error("PNG konnte nicht erzeugt werden.")),
      "image/png",
    ),
  );
  downloadFile(blob, filename, "image/png");
}

/** Diagramm als einseitiges PDF, A4 quer, auf die Breite skaliert (E18). */
export async function downloadChartPdf(
  input: ChartExportInput,
  filename: string,
) {
  const { svg, width, height } = chartSvg(input);
  // Etwa 300 dpi auf der Seitenbreite, mindestens doppelte Auflösung.
  const scale = Math.max(2, Math.min(4, 3300 / width));
  const canvas = await rasterize(svg, width, height, scale);
  const rgba = canvas
    .getContext("2d")!
    .getImageData(0, 0, canvas.width, canvas.height).data;
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  const pdf = imagePdf({
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    deflatedRgb: await deflate(rgb),
    title: input.title,
  });
  downloadFile(pdf as BlobPart, filename, "application/pdf");
}

/** Dateiname ohne Zeichen, die Windows oder macOS nicht erlauben. */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Szenario";
}
