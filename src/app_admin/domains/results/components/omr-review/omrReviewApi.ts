/**
 * PATH: src/app_admin/domains/results/components/omr-review/omrReviewApi.ts
 *
 * OMR 검토 워크스페이스 전용 API.
 * - 목록: /submissions/submissions/exams/<id>/  (ExamSubmissionsListView 확장)
 * - 상세: /submissions/submissions/<pk>/manual-edit/  (GET)
 * - 저장: manualEditSubmissionApi 재사용
 */

import api from "@/shared/api/axios";

export type OmrAnswerStats = {
  total: number;
  ok: number;
  blank: number;
  ambiguous: number;
  error: number;
  avg_confidence: number | null;
};

export type OmrReviewRow = {
  id: number;
  enrollment_id: number;
  student_name: string;
  status: string;
  source: string;
  score: number | null;
  created_at: string;
  file_key: string;
  has_file: boolean;
  manual_review_required: boolean;
  manual_review_reasons: string[];
  identifier_status: string | null;
  // 자동채점 진단 필드 (backend exam_submissions_list_view 2026-04-22+)
  answer_stats?: OmrAnswerStats | null;
  aligned?: boolean | null;
  alignment_method?: string | null;
  sheet_version?: string | null;
};

/** OMR 버블·문항 영역 좌표 (원본 이미지 픽셀 기준). worker v10.1+ 제공. */
export type OmrBubbleRect = {
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type OmrAnswerMeta = {
  version?: string;
  detected?: (string | number)[];
  marking?: "single" | "blank" | "multi" | string;
  confidence?: number;
  status?: "ok" | string;
  /** 문항 전체 영역 bbox (모든 버블의 bounding box) */
  rect?: OmrBubbleRect | null;
  /** 개별 버블 bbox 배열 */
  bubble_rects?: OmrBubbleRect[] | null;
};

export type OmrReviewDetailAnswer = {
  question_id: number;
  question_no: number;
  answer: string;
  omr: OmrAnswerMeta | null;
};

/**
 * 같은 (시험, 학생) 다른 진행/완료 OMR. 학원장이 한 장만 채택하도록 표시한다.
 * - status: 'done' = 이미 채점 완료된 형제, 'needs_identification'/'answers_ready' 등 = 검토 중 형제.
 * - 빈 배열이면 cluster 표시 X.
 */
export type DuplicateSibling = {
  submission_id: number;
  status: string;
  identifier_status: string | null;
  manual_review_required: boolean;
  created_at: string | null;
  scan_image_url: string;
  scan_image_is_aligned: boolean;
};

export type OmrReviewDetail = {
  submission_id: number;
  submission_status: string;
  enrollment_id: number | null;
  target_type: string;
  target_id: number;
  identifier: unknown;
  answers: OmrReviewDetailAnswer[];
  scan_image_url: string;
  original_scan_image_url?: string;
  scan_image_is_aligned?: boolean;
  /** 표시 중인 스캔 이미지 크기 (BBox 좌표 정규화용). 없으면 img.naturalWidth/Height 사용. */
  scan_image_size?: { width: number; height: number } | null;
  meta: {
    manual_review?: {
      required?: boolean;
      reasons?: string[];
      updated_at?: string | null;
      resolved_at?: string | null;
    } | null;
    ai_result?: unknown;
    identifier_status?: string | null;
  };
  /** 같은 학생·시험의 다른 OMR 후보. 있으면 cluster UI 표시. */
  duplicate_siblings?: DuplicateSibling[];
};

export type AcceptFromDuplicatesResult = {
  submission_id: number;
  status: string;
  discarded_count: number;
  superseded_count: number;
  skipped: Array<{ id: number; reason: string }>;
  score: number | null;
  max_score: number | null;
};

/**
 * 본 submission을 같은 (시험, 학생) 후보 중 채택.
 * 백엔드가 단일 트랜잭션으로 본 sub은 DONE까지 진행 + 다른 active 형제는
 * DONE이면 SUPERSEDED, 그 외는 'discarded:duplicate'로 폐기한다.
 */
export async function acceptFromDuplicatesApi(
  submissionId: number,
): Promise<AcceptFromDuplicatesResult> {
  const res = await api.post(
    `/submissions/submissions/${submissionId}/accept-from-duplicates/`,
  );
  return res.data as AcceptFromDuplicatesResult;
}

export async function listOmrReviewRows(examId: number): Promise<OmrReviewRow[]> {
  const res = await api.get(`/submissions/submissions/exams/${examId}/`);
  const data = res.data;
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.results)
    ? data.results
    : [];
  return items as OmrReviewRow[];
}

export async function fetchOmrReviewDetail(submissionId: number): Promise<OmrReviewDetail> {
  const res = await api.get(`/submissions/submissions/${submissionId}/manual-edit/`);
  return res.data as OmrReviewDetail;
}

/* 학생 picker — OMR 검토용 응시 대상 후보 */
export type CandidateRow = {
  enrollment_id: number;
  student_name: string;
  student_phone_last4: string;
  parent_phone_last4: string;
  lecture_title: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  already_matched: boolean;
};

export async function fetchExamCandidates(
  examId: number,
  q: string,
): Promise<CandidateRow[]> {
  const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const res = await api.get(`/submissions/submissions/exams/${examId}/candidates/${params}`);
  return (Array.isArray(res.data) ? res.data : []) as CandidateRow[];
}

export async function fetchHomeworkCandidates(
  homeworkId: number,
  q: string,
): Promise<CandidateRow[]> {
  const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const res = await api.get(`/submissions/submissions/homework/${homeworkId}/candidates/${params}`);
  return (Array.isArray(res.data) ? res.data : []) as CandidateRow[];
}
