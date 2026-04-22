// PATH: src/app_admin/domains/storage/components/matchup/filesToPdf.ts
// PDF + 이미지 혼합 File[] → 단일 PDF File 병합.
// 선생님이 여러 PDF + 이미지 섞어서 올려도 자동으로 1개로 합쳐짐.
//
// pdf-lib를 번들에서 lazy import (초기 번들 크기 영향 최소화, 외부 CDN 비의존).

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);
const PDF_TYPE = "application/pdf";

export function isImage(f: File): boolean {
  return IMAGE_TYPES.has(f.type);
}

export function isPdf(f: File): boolean {
  return f.type === PDF_TYPE;
}

/**
 * 혼합 파일 배열 (PDF + 이미지) → 단일 PDF File.
 *
 * - PDF 파일: 페이지 전부 복사 (원본 벡터/텍스트 보존)
 * - 이미지 파일: A4 세로, 비율 유지, 중앙 배치, 8mm 여백
 * - 입력 순서 = 결과 페이지 순서
 */
export async function filesToPdf(
  files: File[],
  outName = "merged.pdf",
): Promise<File> {
  if (files.length === 0) {
    throw new Error("파일이 없습니다");
  }

  const { PDFDocument, PageSizes } = await import("pdf-lib");

  const merged = await PDFDocument.create();
  const [A4_W, A4_H] = PageSizes.A4; // pt
  const MARGIN_PT = 8 * 2.83465; // 8mm → pt

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (isPdf(file)) {
      let src;
      try {
        src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (err) {
        throw new Error(`PDF 파일을 읽을 수 없습니다: ${file.name} (손상/암호화 가능성)`);
      }
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
      continue;
    }

    if (!isImage(file)) {
      throw new Error(`지원하지 않는 파일 형식: ${file.name}`);
    }

    const page = merged.addPage([A4_W, A4_H]);
    const img =
      file.type === "image/png"
        ? await merged.embedPng(bytes)
        : await merged.embedJpg(bytes);

    const maxW = A4_W - MARGIN_PT * 2;
    const maxH = A4_H - MARGIN_PT * 2;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const drawW = img.width * ratio;
    const drawH = img.height * ratio;
    page.drawImage(img, {
      x: (A4_W - drawW) / 2,
      y: (A4_H - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  const out = await merged.save();
  // new File([...]) 타입이 ArrayBuffer만 받아서 Uint8Array → ArrayBuffer 사본
  const buf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  return new File([buf], outName, { type: PDF_TYPE });
}
