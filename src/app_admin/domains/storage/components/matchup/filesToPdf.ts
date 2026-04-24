// PATH: src/app_admin/domains/storage/components/matchup/filesToPdf.ts
// PDF + 이미지 혼합 File[] → 단일 PDF File 병합.
// 선생님이 여러 PDF + 이미지 섞어서 올려도 자동으로 1개로 합쳐짐.
//
// pdf-lib를 번들에서 lazy import (초기 번들 크기 영향 최소화, 외부 CDN 비의존).
// HEIC(iPhone 기본 포맷)는 heic2any로 JPEG 변환 후 병합.

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const PDF_TYPE = "application/pdf";

export function isImage(f: File): boolean {
  if (IMAGE_TYPES.has(f.type)) return true;
  // 일부 브라우저/OS는 HEIC에 MIME을 안 붙임 — 확장자로 보조 판별
  const name = f.name.toLowerCase();
  return isHeic(f) || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
}

export function isHeic(f: File): boolean {
  if (HEIC_TYPES.has(f.type)) return true;
  const name = f.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

export function isPdf(f: File): boolean {
  if (f.type === PDF_TYPE) return true;
  return f.name.toLowerCase().endsWith(".pdf");
}

/**
 * HEIC → JPEG 변환. heic2any lazy import.
 * 실패 시 명시적 에러 throw (조용한 실패 방지).
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  try {
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    const base = file.name.replace(/\.(heic|heif)$/i, "");
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    throw new Error(
      `HEIC 이미지를 변환할 수 없습니다: ${file.name} ` +
        `(아이폰 설정 > 카메라 > 포맷에서 "호환성 우선"으로 바꾸면 안정적입니다)`,
    );
  }
}

export type MergeProgressPhase = "heic" | "pdf";
export type MergeProgress = {
  phase: MergeProgressPhase;
  current: number; // 1-based
  total: number;
};
export type MergeOptions = {
  onProgress?: (p: MergeProgress) => void;
};

/**
 * 혼합 파일 배열 (PDF + 이미지 + HEIC) → 단일 PDF File.
 *
 * - HEIC 파일: 먼저 JPEG로 변환 (heic2any, lazy import)
 * - PDF 파일: 페이지 전부 복사 (원본 벡터/텍스트 보존)
 * - 이미지 파일: A4 세로, 비율 유지, 중앙 배치, 8mm 여백
 * - 입력 순서 = 결과 페이지 순서
 * - onProgress: heic 변환 + pdf 병합 각 단계 N/Total 표시
 */
export async function filesToPdf(
  files: File[],
  outName = "merged.pdf",
  opts: MergeOptions = {},
): Promise<File> {
  if (files.length === 0) {
    throw new Error("파일이 없습니다");
  }

  const { onProgress } = opts;

  // 1. HEIC 선변환 — 순차 (heic2any는 메모리/CPU 많이 쓰므로 병렬 X)
  const heicIdx = files.map((f, i) => (isHeic(f) ? i : -1)).filter((i) => i >= 0);
  const resolved: File[] = [...files];
  for (let i = 0; i < heicIdx.length; i++) {
    const idx = heicIdx[i];
    onProgress?.({ phase: "heic", current: i + 1, total: heicIdx.length });
    resolved[idx] = await convertHeicToJpeg(files[idx]);
  }

  // 2. PDF 병합
  const { PDFDocument, PageSizes } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  const [A4_W, A4_H] = PageSizes.A4; // pt
  const MARGIN_PT = 8 * 2.83465; // 8mm → pt

  for (let i = 0; i < resolved.length; i++) {
    const file = resolved[i];
    onProgress?.({ phase: "pdf", current: i + 1, total: resolved.length });
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (isPdf(file)) {
      let src;
      try {
        src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch {
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
    const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const img = isPng
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
