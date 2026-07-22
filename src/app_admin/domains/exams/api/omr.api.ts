// PATH: src/app_admin/domains/exams/api/omrApi.ts
// OMR 답안지 API — 백엔드 SSOT 기반

import api from "@/shared/api/axios";

export type OMRDefaults = {
  exam_title: string;
  lecture_name: string;
  session_name: string;
  mc_count: number;
  essay_count: number;
  include_optional_essay_area: boolean;
  can_include_optional_essay_area: boolean;
  n_choices: number;
  question_types: Array<"choice" | "essay">;
  choice_question_numbers: number[];
  essay_question_numbers: number[];
  logo_url: string | null;
};

export type OMRParams = {
  exam_title?: string;
  lecture_name?: string;
  session_name?: string;
  mc_count: number;
  essay_count: number;
  include_optional_essay_area: boolean;
  n_choices: number;
  choice_question_numbers?: number[];
  essay_question_numbers?: number[];
};

export type OMRTarget =
  | { type: "exam"; examId: number }
  | { type: "tool" };

function toStaticPreviewHtml(html: string): string {
  if (!html) return html;

  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script, iframe, object, embed").forEach((el) => el.remove());
      doc.querySelectorAll("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value.trim().toLowerCase();
          if (name.startsWith("on") || value.startsWith("javascript:")) {
            el.removeAttribute(attr.name);
          }
        }
      });
      return `<!doctype html>\n${doc.documentElement.outerHTML}`;
    } catch {
      // Fall back to string cleanup below.
    }
  }

  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/\s+on\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"]?)javascript:[^\s>]*\2/gi, "");
}

/** 시험 기반 OMR 기본값 조회 */
export async function fetchOMRDefaults(examId: number): Promise<OMRDefaults> {
  const { data } = await api.get<OMRDefaults>(`/exams/${examId}/omr/defaults/`);
  return data;
}

/** 시험 기반 OMR HTML 프리뷰 */
export async function fetchOMRPreviewForTarget(target: OMRTarget, params: OMRParams): Promise<string> {
  const path = target.type === "exam"
    ? `/exams/${target.examId}/omr/preview/`
    : "/tools/omr/preview/";
  const { data } = await api.post<string>(path, params, {
    responseType: "text",
    headers: { Accept: "text/html" },
  });
  return toStaticPreviewHtml(data);
}

/** 시험 기반 OMR PDF 다운로드 — PDF 생성은 무거운 endpoint, axios 글로벌 20s 부족 (참고: matchup hit-report.pdf adf1e387) */
export async function downloadOMRPdfForTarget(target: OMRTarget, params: OMRParams, filename?: string): Promise<void> {
  const path = target.type === "exam"
    ? `/exams/${target.examId}/omr/pdf/`
    : "/tools/omr/pdf/";
  const { data } = await api.post(path, params, {
    responseType: "blob",
    timeout: 5 * 60_000,
  });
  const { downloadBlob } = await import("@/shared/utils/safeDownload");
  downloadBlob(data as Blob, `${filename || params.exam_title || "OMR"}_OMR.pdf`);
}

/** 시험 기반 OMR HTML 프리뷰 */
export async function fetchOMRPreview(examId: number, params: OMRParams): Promise<string> {
  return fetchOMRPreviewForTarget({ type: "exam", examId }, params);
}

/** 시험 기반 OMR PDF 다운로드 */
export async function downloadOMRPdf(examId: number, params: OMRParams, filename?: string): Promise<void> {
  return downloadOMRPdfForTarget({ type: "exam", examId }, params, filename);
}

/** 도구 페이지용 OMR HTML 프리뷰 */
export async function fetchToolsOMRPreview(params: OMRParams & { exam_title: string }): Promise<string> {
  return fetchOMRPreviewForTarget({ type: "tool" }, params);
}

/** 도구 페이지용 OMR PDF 다운로드 — PDF 생성은 무거운 endpoint, axios 글로벌 20s 부족 */
export async function downloadToolsOMRPdf(params: OMRParams & { exam_title: string }): Promise<void> {
  return downloadOMRPdfForTarget({ type: "tool" }, params, params.exam_title || "OMR");
}
