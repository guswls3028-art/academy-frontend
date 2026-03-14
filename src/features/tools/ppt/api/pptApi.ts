// PATH: src/features/tools/ppt/api/pptApi.ts
// PPT 생성 API 호출

import api from "@/shared/api/axios";

export interface PptSettings {
  aspect_ratio: "16:9" | "4:3";
  background: string;
  fit_mode: "contain" | "cover" | "stretch";
  invert: boolean;
  grayscale: boolean;
  auto_enhance: boolean;
  brightness: number;
  contrast: number;
  per_slide?: Array<{
    invert?: boolean;
    grayscale?: boolean;
    auto_enhance?: boolean;
    brightness?: number;
    contrast?: number;
  }>;
}

export interface PptGenerateResponse {
  download_url: string;
  filename: string;
  slide_count: number;
  size_bytes: number;
}

export async function generatePpt(
  images: File[],
  order: number[],
  settings: PptSettings,
  onProgress?: (pct: number) => void,
): Promise<PptGenerateResponse> {
  const form = new FormData();

  for (const file of images) {
    form.append("images", file);
  }

  form.append("order", JSON.stringify(order));
  form.append("settings", JSON.stringify(settings));

  const resp = await api.post<PptGenerateResponse>("/tools/ppt/generate/", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000, // 2분 (대량 이미지 처리)
    onUploadProgress: onProgress
      ? (e) => {
          if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        }
      : undefined,
  });

  return resp.data;
}
