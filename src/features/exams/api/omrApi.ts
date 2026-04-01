// PATH: src/features/exams/api/omrApi.ts
// OMR 답안지 API — 백엔드 SSOT 기반

import api from "@/shared/api/axios";

export type OMRDefaults = {
  exam_title: string;
  lecture_name: string;
  session_name: string;
  mc_count: number;
  essay_count: number;
  n_choices: number;
  logo_url: string | null;
};

export type OMRParams = {
  exam_title?: string;
  lecture_name?: string;
  session_name?: string;
  mc_count: number;
  essay_count: number;
  n_choices: number;
};

/** 시험 기반 OMR 기본값 조회 */
export async function fetchOMRDefaults(examId: number): Promise<OMRDefaults> {
  const { data } = await api.get<OMRDefaults>(`/exams/${examId}/omr/defaults/`);
  return data;
}

/** 시험 기반 OMR HTML 프리뷰 */
export async function fetchOMRPreview(examId: number, params: OMRParams): Promise<string> {
  const { data } = await api.post<string>(`/exams/${examId}/omr/preview/`, params, {
    responseType: "text",
    headers: { Accept: "text/html" },
  });
  return data;
}

/** 시험 기반 OMR PDF 다운로드 */
export async function downloadOMRPdf(examId: number, params: OMRParams, filename?: string): Promise<void> {
  const { data } = await api.post(`/exams/${examId}/omr/pdf/`, params, {
    responseType: "blob",
  });
  const { downloadBlob } = await import("@/shared/utils/safeDownload");
  downloadBlob(data as Blob, `${filename || params.exam_title || "OMR"}_OMR.pdf`);
}

/** 도구 페이지용 OMR HTML 프리뷰 */
export async function fetchToolsOMRPreview(params: OMRParams & { exam_title: string }): Promise<string> {
  const { data } = await api.post<string>("/tools/omr/preview/", params, {
    responseType: "text",
    headers: { Accept: "text/html" },
  });
  return data;
}

/** 도구 페이지용 OMR PDF 다운로드 */
export async function downloadToolsOMRPdf(params: OMRParams & { exam_title: string }): Promise<void> {
  const { data } = await api.post("/tools/omr/pdf/", params, {
    responseType: "blob",
  });
  const { downloadBlob } = await import("@/shared/utils/safeDownload");
  downloadBlob(data as Blob, `${params.exam_title || "OMR"}_OMR.pdf`);
}
