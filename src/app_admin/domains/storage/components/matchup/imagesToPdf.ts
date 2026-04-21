// PATH: src/app_admin/domains/storage/components/matchup/imagesToPdf.ts
// 여러 이미지 → 단일 PDF 병합. 선생님이 폰으로 여러 장 촬영한 시험지를
// 업로드할 때 PDF 변환 없이 바로 올릴 수 있도록 지원.

/**
 * 이미지 File[] → 단일 PDF File
 * - A4 세로, 이미지 비율 유지, 중앙 배치
 * - 입력 순서대로 페이지 생성
 */
export async function imagesToPdf(files: File[], outName = "scan.pdf"): Promise<File> {
  if (files.length === 0) {
    throw new Error("이미지가 없습니다");
  }

  // @ts-expect-error CDN dynamic import
  const jpMod: any = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm");
  const { jsPDF } = jpMod;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const dataUrl = await fileToDataUrl(file);
    const dims = await imageDims(dataUrl);

    // A4에 이미지 비율 유지하며 중앙 배치 (여백 8mm)
    const margin = 8;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = Math.min(maxW / dims.w, maxH / dims.h);
    const drawW = dims.w * ratio;
    const drawH = dims.h * ratio;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    if (i > 0) pdf.addPage();

    // JPEG로 압축해서 추가 (PNG는 용량 큼)
    const format = file.type === "image/png" ? "PNG" : "JPEG";
    pdf.addImage(dataUrl, format, x, y, drawW, drawH, undefined, "FAST");
  }

  const blob = pdf.output("blob");
  return new File([blob], outName, { type: "application/pdf" });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function imageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}
