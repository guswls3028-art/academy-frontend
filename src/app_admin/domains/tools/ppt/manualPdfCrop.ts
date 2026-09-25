import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export interface PdfCropRegion {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function openLocalPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  return task.promise;
}

export function normaliseCrop(
  page: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  id: string,
): PdfCropRegion | null {
  const x0 = Math.max(0, Math.min(1, Math.min(start.x, end.x)));
  const y0 = Math.max(0, Math.min(1, Math.min(start.y, end.y)));
  const x1 = Math.max(0, Math.min(1, Math.max(start.x, end.x)));
  const y1 = Math.max(0, Math.min(1, Math.max(start.y, end.y)));
  if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return null;
  return { id, page, x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export async function renderCropFiles(
  file: File,
  regions: PdfCropRegion[],
  onProgress?: (done: number, total: number) => void,
): Promise<File[]> {
  if (!regions.length || regions.length > 500) throw new Error("자를 영역을 1~500개 선택해주세요.");
  const doc = await openLocalPdf(file);
  const output: File[] = [];
  let totalBytes = 0;
  let cachedPage = 0;
  let source: HTMLCanvasElement | null = null;
  try {
    for (const [index, region] of regions.entries()) {
      if (region.page < 1 || region.page > doc.numPages) throw new Error("원본 PDF의 페이지가 바뀌었습니다. 다시 선택해주세요.");
      if (!source || cachedPage !== region.page) {
        const page = await doc.getPage(region.page);
        const viewport = page.getViewport({ scale: 2 });
        source = document.createElement("canvas");
        source.width = Math.ceil(viewport.width);
        source.height = Math.ceil(viewport.height);
        const context = source.getContext("2d");
        if (!context) throw new Error("PDF 화면을 그릴 수 없습니다.");
        await page.render({ canvas: source, canvasContext: context, viewport }).promise;
        cachedPage = region.page;
      }
      const sx = Math.floor(region.x * source.width);
      const sy = Math.floor(region.y * source.height);
      const width = Math.min(source.width - sx, Math.ceil(region.width * source.width));
      const height = Math.min(source.height - sy, Math.ceil(region.height * source.height));
      if (width < 10 || height < 10) throw new Error("선택 영역이 너무 작습니다. 다시 자르세요.");
      const crop = document.createElement("canvas");
      crop.width = width;
      crop.height = height;
      crop.getContext("2d")?.drawImage(source, sx, sy, width, height, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        crop.toBlob((value) => value ? resolve(value) : reject(new Error("선택 영역을 이미지로 만들지 못했습니다.")), "image/png");
      });
      totalBytes += blob.size;
      if (totalBytes > 1024 * 1024 * 1024) throw new Error("선택한 영역의 총 용량이 1GB를 넘습니다. 영역을 줄여주세요.");
      output.push(new File([blob], `slide-${String(index + 1).padStart(3, "0")}-page-${region.page}.png`, { type: "image/png" }));
      onProgress?.(index + 1, regions.length);
    }
    return output;
  } finally {
    await doc.loadingTask.destroy();
  }
}
