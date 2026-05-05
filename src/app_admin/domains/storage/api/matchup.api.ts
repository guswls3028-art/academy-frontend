// PATH: src/app_admin/domains/storage/api/matchup.api.ts
// 매치업 API — 문서 업로드, 문제 조회, 유사 검색

import api from "@/shared/api/axios";

// ── Types ──

export type SegmentationMethod = "text" | "ocr" | "mixed" | "image" | "none";

// 페이지별 자동 분류된 시험지 유형. 백엔드 paper-type classifier와 동기.
//   clean_pdf_*           : 깨끗한 PDF (정상)
//   quadrant              : 4분할 시험지
//   scan_*                : 스캔본
//   student_answer_photo  : 학생 답안지 폰사진 (필기 침범, 자동분리 신뢰도 낮음)
//   side_notes            : 학습자료 본문 항목번호
//   non_question          : 표지/정답지/해설지/목차
//   unknown               : 분류 불명
export type PaperType =
  | "clean_pdf_single"
  | "clean_pdf_dual"
  | "quadrant"
  | "scan_single"
  | "scan_dual"
  | "student_answer_photo"
  | "side_notes"
  | "non_question"
  | "unknown";

// paper-type summary warning enum — 백엔드와 동기.
export type PaperTypeWarning =
  | "student_answer_photo_detected"
  | "low_confidence_source_majority"
  | "non_question_majority"
  | "review_required";  // Phase 3 — low_conf 페이지 비율 ≥ 20% 시 검수 필요

// Phase 3: per-page confidence + low_conf reasons.
export type LowConfPage = {
  idx: number;
  confidence: number;  // 0.0 ~ 1.0
  reasons: string[];   // ["paper_type_unknown", "no_boxes_detected", ...]
  paper_type: string;
  n_boxes: number;
};

export type PaperTypeSummary = {
  distribution: Partial<Record<PaperType, number>> & Record<string, number>;
  low_confidence_ratio: number; // 0.0 ~ 1.0
  primary: PaperType | string;
  warnings: Array<PaperTypeWarning | string>;
  // Phase 3 (2026-05-02) — 검수 우선순위 페이지 + 평균 신뢰도
  low_conf_pages?: LowConfPage[];
  page_confidence_avg?: number;  // 0.0 ~ 1.0
};

// Phase 1A: source_type 7-value SSOT (backend `source_types.py` 동기).
export type MatchupSourceType =
  | "student_exam_photo"
  | "school_exam_pdf"
  | "commercial_workbook"
  | "academy_workbook"
  | "explanation"
  | "answer_key"
  | "other";

export type MatchupDocumentMeta = {
  segmentation_method?: SegmentationMethod;
  // legacy 2-value (잔존)
  upload_intent?: "reference" | "test" | MatchupSourceType;
  document_role?: "reference_material" | "exam_sheet";
  // 7-value SSOT
  source_type?: MatchupSourceType;
  indexable?: boolean;  // false면 매치업 검색에 포함 X (explanation/answer_key)
  paper_type_summary?: PaperTypeSummary;
  // Phase 5-deep: 학원장이 검수 모달에서 매치업 인덱싱 제외한 페이지 idx 리스트.
  // 다음 reanalyze 시 워커가 해당 페이지 skip → 다시 problem 생성 안 됨.
  excluded_pages?: number[];
  [key: string]: unknown;
};

export type MatchupDocument = {
  id: number;
  title: string;
  category?: string;
  subject: string;
  grade_level: string;
  original_name: string;
  size_bytes: number;
  content_type: string;
  status: "pending" | "processing" | "done" | "failed";
  ai_job_id: string;
  problem_count: number;
  error_message: string;
  // null: 기존 문서(migration 이전) 호환. `doc.meta?.field` 접근 필수.
  meta: MatchupDocumentMeta | null;
  // 저장소(InventoryFile) FK — storage-as-canonical 모델 (M-3 이후 NOT NULL).
  // 기존 데이터(M-2 이전 잔재)는 0006 backfill로 모두 채워짐.
  inventory_file_id: number;
  created_at: string;
  updated_at: string;
};

// problem.meta — 백엔드가 채우는 known 필드. 알려지지 않은 키도 들어올 수 있어 unknown 합집합.
//   merge_suspect       : 인접 문항이 합쳐졌을 가능성
//   is_partial          : 파이프라인 진행 중 skeleton row
//   number_mismatch     : OCR로 본문 첫 줄에서 인식한 번호가 DB number와 다른 경우
//                         "Q3 적중자료가 Q5 본문" 식 신뢰성 사고 차단용 검수 신호
export type MatchupProblemMeta = {
  merge_suspect?: boolean;
  is_partial?: boolean;
  number_mismatch?: { db: number; ocr: number };
  [key: string]: unknown;
};

export type MatchupProblem = {
  id: number;
  document_id: number;
  number: number;
  text: string;
  image_key: string;
  image_url?: string;
  meta: MatchupProblemMeta;
  created_at: string;
};

export type SimilarProblem = {
  id: number;
  document_id: number;
  document_title: string;
  number: number;
  text: string;
  similarity: number;
  image_url?: string;
  // Phase 2: 출처 정보 (시험 문제 인덱싱 후)
  source_type?: "matchup" | "exam";
  source_lecture_title?: string;
  source_session_title?: string;
  source_exam_title?: string;
};

// ── Documents ──

export async function fetchMatchupDocuments(): Promise<MatchupDocument[]> {
  const { data } = await api.get<MatchupDocument[]>("/matchup/documents/");
  return data;
}

export async function uploadMatchupDocument(payload: {
  file: File;
  title?: string;
  category?: string;
  subject?: string;
  grade_level?: string;
  intent?: "reference" | "test";
  // Phase 1C — 7-value SSOT (backend strategy router 1순위 신호)
  source_type?: MatchupSourceType;
}): Promise<MatchupDocument> {
  const form = new FormData();
  form.append("file", payload.file);
  if (payload.title) form.append("title", payload.title);
  if (payload.category) form.append("category", payload.category);
  if (payload.subject) form.append("subject", payload.subject);
  if (payload.grade_level) form.append("grade_level", payload.grade_level);
  // source_type 우선, 미지정 시 legacy intent 전송. backend가 정규화 흡수.
  form.append("intent", payload.intent ?? "reference");
  if (payload.source_type) form.append("source_type", payload.source_type);

  const { data } = await api.post<MatchupDocument>(
    "/matchup/documents/upload/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      // 파일 업로드는 axios 기본 20초 timeout이 부족 (200MB까지 허용 + 다중 파일 동시 업로드).
      // 5분으로 override — R2 업로드 + DB 저장 + 큐 dispatch.
      timeout: 5 * 60_000,
    },
  );
  return data;
}

export type PromoteAlreadyExistsError = Error & {
  status: 409;
  code: "already_promoted";
  documentId: number;
};

/**
 * 저장소 InventoryFile을 매치업 분석 대상으로 승격.
 * 이미 승격된 파일이면 PromoteAlreadyExistsError(status=409)를 throw.
 */
export async function promoteInventoryToMatchup(payload: {
  inventoryFileId: string | number;
  title?: string;
  category?: string;
  subject?: string;
  gradeLevel?: string;
}): Promise<MatchupDocument> {
  try {
    const { data } = await api.post<MatchupDocument>(
      "/matchup/documents/promote/",
      {
        inventory_file_id: Number(payload.inventoryFileId),
        title: payload.title,
        category: payload.category,
        subject: payload.subject,
        grade_level: payload.gradeLevel,
      },
    );
    return data;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "response" in e) {
      const ax = (e as { response?: { status?: number; data?: Record<string, unknown> } }).response;
      if (ax?.status === 409 && ax?.data?.code === "already_promoted") {
        const err = new Error(String(ax.data.detail ?? "이미 승격됨")) as PromoteAlreadyExistsError;
        err.status = 409;
        err.code = "already_promoted";
        err.documentId = Number(ax.data.document_id ?? 0);
        throw err;
      }
    }
    throw e;
  }
}

// ── Categories (bulk operations) ──

export type MatchupCategoryStat = {
  name: string;
  total: number;
  tests: number;
  references: number;
};

export async function fetchMatchupCategories(): Promise<MatchupCategoryStat[]> {
  const { data } = await api.get<MatchupCategoryStat[]>("/matchup/categories/");
  return data;
}

export async function renameMatchupCategory(payload: {
  from: string;
  to: string;
}): Promise<{ updated: number; category: string }> {
  const { data } = await api.post<{ updated: number; category: string }>(
    "/matchup/categories/rename/",
    payload,
  );
  return data;
}

export async function assignMatchupCategory(payload: {
  documentIds: number[];
  category: string;
}): Promise<{ updated: number; category: string }> {
  const { data } = await api.post<{ updated: number; category: string }>(
    "/matchup/categories/assign/",
    {
      document_ids: payload.documentIds,
      category: payload.category,
    },
  );
  return data;
}

export async function updateMatchupDocument(
  id: number,
  payload: {
    title?: string; category?: string; subject?: string; grade_level?: string;
    intent?: "reference" | "test";
    // Phase 1A: 7-value SSOT (post-upload 보정 UI에서 사용)
    source_type?: MatchupSourceType;
  },
): Promise<MatchupDocument> {
  const { data } = await api.patch<MatchupDocument>(
    `/matchup/documents/${id}/`,
    payload,
  );
  return data;
}

export async function deleteMatchupDocument(id: number): Promise<void> {
  await api.delete(`/matchup/documents/${id}/`);
}

export async function retryMatchupDocument(id: number): Promise<MatchupDocument> {
  const { data } = await api.post<MatchupDocument>(
    `/matchup/documents/${id}/retry/`,
  );
  return data;
}

// Phase 5-deep — 검수 UI에서 호출. status 무관 재분석 (done 상태도 포함).
// retryMatchupDocument는 failed only — 학원장이 검수 후(excluded_pages 적용/
// source_type 변경 후) done 상태 재처리 트리거 진입점이 별도로 필요.
// 응답: {...MatchupDocument, job_id}
export async function reanalyzeMatchupDocument(id: number): Promise<MatchupDocument & { job_id: string }> {
  const { data } = await api.post<MatchupDocument & { job_id: string }>(
    `/matchup/documents/${id}/reanalyze/`,
  );
  return data;
}

// Phase 5-deep — 검수 UI에서 "이 페이지 제외" CTA. 즉시: 페이지 problems 삭제.
// 영구: doc.meta.excluded_pages 갱신 → 다음 reanalyze 시 워커가 skip.
export async function excludeMatchupPage(
  docId: number,
  pageIndex: number,
): Promise<{ ok: true; doc_id: number; page_index: number; removed_problems: number; excluded_pages: number[] }> {
  const { data } = await api.post<{
    ok: true; doc_id: number; page_index: number;
    removed_problems: number; excluded_pages: number[];
  }>(`/matchup/documents/${docId}/pages/${pageIndex}/exclude/`);
  return data;
}

// P1 (2026-05-04) — exclude 롤백. excluded_pages에서 page 제거.
// problem 복원은 별도 reanalyze 호출 필요 (requires_reanalyze=true 응답).
export async function includeMatchupPage(
  docId: number,
  pageIndex: number,
): Promise<{ ok: true; doc_id: number; page_index: number; excluded_pages: number[]; requires_reanalyze: boolean }> {
  const { data } = await api.post<{
    ok: true; doc_id: number; page_index: number;
    excluded_pages: number[]; requires_reanalyze: boolean;
  }>(`/matchup/documents/${docId}/pages/${pageIndex}/include/`);
  return data;
}

// Phase 5-deep VLM — 검수 UI에서 "VLM 정밀 분석" CTA. ondemand Gemini vision 호출.
// 응답 page_role과 problems[bbox]는 화면에 미리보기로 노출 (현재 자동 분리 결과와 비교).
// 호출 한도 초과 시 429.
export type VlmClassifyResult = {
  ok: true;
  doc_id: number;
  page_index: number;
  page_role: "cover" | "index" | "problem" | "explanation" | "answer_key" | "mixed";
  should_skip: boolean;
  confidence: number;
  problems: Array<{ number: number; bbox: number[]; confidence: number }>;
  debug?: Record<string, unknown>;
};

export async function vlmClassifyMatchupPage(
  docId: number,
  pageIndex: number,
): Promise<VlmClassifyResult> {
  const { data } = await api.post<VlmClassifyResult>(
    `/matchup/documents/${docId}/pages/${pageIndex}/vlm-classify/`,
    {},
    { timeout: 60_000 },  // Gemini vision은 30s 내외, 여유 60s
  );
  return data;
}

export type MatchupDocumentPreview = {
  url: string;
  content_type: string;
  title: string;
  original_name: string;
};

export async function getMatchupDocumentPreview(
  id: number,
): Promise<MatchupDocumentPreview> {
  const { data } = await api.get<MatchupDocumentPreview>(
    `/matchup/documents/${id}/preview/`,
  );
  return data;
}

// ── Cross-doc matches: 시험지 → 자료 매치 매트릭스 ──

export type CrossMatchItem = {
  document_id: number;
  document_title: string;
  problem_number: number;
  similarity: number;
};

export type CrossMatchProblem = {
  problem_id: number;
  problem_number: number;
  problem_text_preview: string;
  best_matches: CrossMatchItem[];
};

export type CrossMatchesResponse = {
  doc_id: number;
  doc_title: string;
  problem_count: number;
  matches: CrossMatchProblem[];
};

export type MatchupDocumentJobStatus = {
  document_id: number;
  status: "pending" | "processing" | "done" | "failed";
  ai_job_id: string;
  problem_count: number;
  title: string;
};

export async function fetchMatchupDocumentJobStatus(
  docId: number,
): Promise<MatchupDocumentJobStatus> {
  const { data } = await api.get<MatchupDocumentJobStatus>(
    `/matchup/documents/${docId}/job/`,
  );
  return data;
}

export async function fetchDocumentCrossMatches(
  docId: number,
  topK = 1,
): Promise<CrossMatchesResponse> {
  const { data } = await api.get<CrossMatchesResponse>(
    `/matchup/documents/${docId}/cross-matches/`,
    { params: { top_k: topK }, timeout: 120_000 },
  );
  return data;
}

// ── Problems ──

export async function fetchMatchupProblems(
  documentId?: number,
): Promise<MatchupProblem[]> {
  const params = documentId ? { document_id: documentId } : {};
  const { data } = await api.get<MatchupProblem[]>("/matchup/problems/", {
    params,
  });
  return data;
}

export async function fetchMatchupProblemDetail(
  id: number,
): Promise<MatchupProblem> {
  const { data } = await api.get<MatchupProblem>(`/matchup/problems/${id}/`);
  return data;
}

export async function findSimilarProblems(
  problemId: number,
  topK = 10,
): Promise<{ results: SimilarProblem[] }> {
  const { data } = await api.post<{ results: SimilarProblem[] }>(
    `/matchup/problems/${problemId}/similar/`,
    { top_k: topK },
  );
  return data;
}

export async function getMatchupProblemPresignUrl(
  problemId: number,
): Promise<string> {
  const { data } = await api.post<{ url: string }>(
    "/matchup/problems/presign/",
    { problem_id: problemId },
  );
  return data.url;
}

export async function deleteMatchupProblem(problemId: number): Promise<void> {
  await api.delete(`/matchup/problems/${problemId}/`);
}

export async function bulkDeleteMatchupProblems(
  docId: number,
  payload: { number_from?: number; number_to?: number; problem_ids?: number[] },
): Promise<{ deleted: number; ids: number[]; preserved_manual: number }> {
  const { data } = await api.post<{ deleted: number; ids: number[]; preserved_manual: number }>(
    `/matchup/documents/${docId}/bulk-delete-problems/`,
    payload,
  );
  return data;
}

export async function updateMatchupProblem(
  problemId: number,
  payload: { number?: number; text?: string },
): Promise<MatchupProblem> {
  const { data } = await api.patch<MatchupProblem>(
    `/matchup/problems/${problemId}/`,
    payload,
  );
  return data;
}

// ── 수동 크롭 ──

export type DocumentPage = {
  index: number;
  url: string;
  width: number;
  height: number;
};

export type DocumentPagesResponse = {
  doc_id: number;
  is_pdf: boolean;
  page_count: number;
  pages: DocumentPage[];
};

export async function fetchDocumentPages(
  docId: number,
): Promise<DocumentPagesResponse> {
  const { data } = await api.get<DocumentPagesResponse>(
    `/matchup/documents/${docId}/pages/`,
    { timeout: 60_000 },
  );
  return data;
}

export type ManualCropPayload = {
  pageIndex: number;
  bbox: { x: number; y: number; w: number; h: number }; // 모두 0..1
  number: number;
  text?: string;
};

export async function manualCropMatchupProblem(
  docId: number,
  payload: ManualCropPayload,
): Promise<MatchupProblem> {
  const { data } = await api.post<MatchupProblem>(
    `/matchup/documents/${docId}/manual-crop/`,
    {
      page_index: payload.pageIndex,
      bbox: payload.bbox,
      number: payload.number,
      text: payload.text ?? "",
    },
  );
  return data;
}

// 같은 doc의 problem N개를 1개로 합치기 — 시험지에서 한 문항이 컬럼/페이지 경계에
// 걸쳐 자동분리에 의해 쪼개진 경우의 운영자 복구 도구.
//   problem_ids 순서 = 위→아래 stack 순서 (첫 번째가 primary).
//   target_number 미지정 시 min(numbers) 사용.
export async function mergeMatchupProblems(
  docId: number,
  problemIds: number[],
  targetNumber?: number,
): Promise<MatchupProblem> {
  const { data } = await api.post<MatchupProblem>(
    `/matchup/documents/${docId}/merge-problems/`,
    {
      problem_ids: problemIds,
      ...(typeof targetNumber === "number" ? { target_number: targetNumber } : {}),
    },
    { timeout: 90_000 },
  );
  return data;
}

// 클립보드/파일 이미지를 problem으로 직접 등록 (PDF 페이지 매뉴얼 크롭 경유 안 함).
// 직접 촬영본·외부 크롭 이미지·메신저 캡처용.
export async function pasteImageAsMatchupProblem(
  docId: number,
  imageFile: File | Blob,
  number: number,
): Promise<MatchupProblem> {
  const form = new FormData();
  form.append("image", imageFile);
  form.append("number", String(number));
  const { data } = await api.post<MatchupProblem>(
    `/matchup/documents/${docId}/paste-problem/`,
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 },
  );
  return data;
}

// ── Job Progress (기존 인프라 재사용) ──
//
// /jobs/<id>/progress/ 응답은 래핑 구조:
//   { job_id, job_type, status: "PENDING"|"RUNNING"|"DONE"|"FAILED", progress: {...}|null, result?: {...} }
// 안쪽 progress 필드에 percent/step이 있고, 작업이 완료되면 progress=null + status=DONE.

export type JobProgressInner = {
  step?: string;
  percent?: number;
  step_index?: number;
  step_total?: number;
  step_name_display?: string;
  step_percent?: number;
};

export type JobProgressEnvelope = {
  job_id: string;
  job_type?: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED" | string;
  progress: JobProgressInner | null;
};

export async function fetchJobProgress(
  jobId: string,
): Promise<JobProgressEnvelope | null> {
  try {
    const { data } = await api.get<JobProgressEnvelope>(`/jobs/${jobId}/progress/`);
    return data;
  } catch {
    return null;
  }
}

// ── 매치업 적중 보고서 (강사 1인의 3중 역할 산출물) ──
//
// 정체성 (2026-05-03~):
//   프리랜서 강사 1인이 작성하는 보고서. 동일 PDF가 동시에 3 역할.
//     ① 수업 히스토리 (강사 자기 검토)
//     ② 제출 리포트 (소속 학원 KPI)
//     ③ 신뢰자료+홍보물 (강사 개인 브랜딩, 카페·면담 등)
//   좌 = 학생 제출 시험지 / 우 = 강사 본인 수업자료. 카테고리당 시험지 1장 + 강사 1명 = 보고서 1건.

export type HitReportEntry = {
  id: number;
  exam_problem_id: number;
  selected_problem_ids: number[];
  comment: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type HitReport = {
  id: number;
  document_id: number;
  document_title: string;
  document_category: string;
  // 작성 강사 정체성 — 보고서의 1순위 메타데이터.
  author_id: number | null;
  author_name: string;
  title: string;
  summary: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  // deprecated — author_name 사용. 호환을 위해 응답에 포함.
  submitted_by_name: string;
  entries: HitReportEntry[];
  created_at: string;
  updated_at: string;
};

// 강사별 보고서 누적 리스트 — 수업 히스토리 + 제출 KPI 동선.
export type HitReportListItem = {
  id: number;
  document_id: number;
  document_title: string;
  document_category: string;
  author_id: number | null;
  author_name: string;
  title: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  exam_count: number;
  curated_count: number;
  curated_progress: number;  // 0~100, 작성률(%).
  // 적중률 = sim≥0.75 큐레이션 자료 1건 이상 보유 문항 / 전체 문항.
  // PDF 표지 헤드라인과 동일 정의. backend가 cosine으로 산출.
  hit_count: number;
  hit_rate: number;          // 0~100, 적중률(%).
  created_at: string;
  updated_at: string;
};

export type HitReportListResponse = {
  reports: HitReportListItem[];
  summary: {
    total: number;
    submitted: number;
    drafts: number;
    // 강사 통산 적중률 = 모든 보고서의 hit_count 합 / exam_count 합 × 100.
    avg_hit_rate: number;
    total_hit: number;
    total_exam: number;
  };
};

export async function fetchHitReportList(params?: {
  mine?: boolean;
  status?: "draft" | "submitted";
  category?: string;
}): Promise<HitReportListResponse> {
  const q: Record<string, string> = {};
  if (params?.mine) q.mine = "1";
  if (params?.status) q.status = params.status;
  if (params?.category) q.category = params.category;
  const { data } = await api.get<HitReportListResponse>(
    "/matchup/hit-reports/",
    { params: q },
  );
  return data;
}

export type HitReportCandidate = {
  id: number;
  document_id: number;
  // 출처 식별 메타 — "자료 198번"만 보고 강사가 출처를 다시 찾던 불편 제거 (2026-05-05).
  document_title: string;
  document_category: string;
  source_type: string;  // "academy_workbook" | "school_exam_pdf" | ... | "" (legacy)
  number: number;
  text_preview: string;
  similarity: number;
  image_key: string;
  image_url?: string;
};

export type HitReportExamProblem = {
  id: number;
  number: number;
  text_preview: string;
  image_key: string;
  image_url?: string;
  candidates: HitReportCandidate[];
  entry: {
    id: number;
    selected_problem_ids: number[];
    comment: string;
    order: number;
    // 강사가 매칭 못한/큐레이션 의도 없는 Q를 PDF에서 빼는 토글 (2026-05-05).
    excluded: boolean;
  } | null;
};

export type HitReportSelectedMeta = {
  id: number;
  document_id: number;
  document_title: string;
  document_category: string;
  source_type: string;
  number: number;
  text_preview: string;
  image_key: string;
  image_url?: string;
};

export type HitReportDraftResponse = {
  report: HitReport;
  exam_problems: HitReportExamProblem[];
  selected_problem_meta: HitReportSelectedMeta[];
};

export async function fetchHitReportDraft(
  docId: number,
): Promise<HitReportDraftResponse> {
  const { data } = await api.get<HitReportDraftResponse>(
    `/matchup/documents/${docId}/hit-report-draft/`,
    { timeout: 120_000 },
  );
  return data;
}

// 자동저장 timeout — axios 기본 20s가 backend ResponseTime spike(ASG refresh cold start
// + pgvector HNSW index build 시 27~51초 측정, 2026-05-05)를 못 cover해서 학원장
// "저장 실패" 토스트가 간헐 발생했던 결함 fix. spike 절대 한도 60s로 상향.
const HIT_REPORT_SAVE_TIMEOUT_MS = 60_000;

export async function updateHitReport(
  reportId: number,
  payload: { title?: string; summary?: string },
): Promise<HitReport> {
  const { data } = await api.patch<HitReport>(
    `/matchup/hit-reports/${reportId}/`,
    payload,
    { timeout: HIT_REPORT_SAVE_TIMEOUT_MS },
  );
  return data;
}

export async function upsertHitReportEntries(
  reportId: number,
  entries: Array<{
    exam_problem_id: number;
    selected_problem_ids: number[];
    comment: string;
    order: number;
    excluded?: boolean;
  }>,
): Promise<{ upserted: number; deleted: number }> {
  const { data } = await api.post<{ upserted: number; deleted: number }>(
    `/matchup/hit-reports/${reportId}/entries/`,
    { entries },
    { timeout: HIT_REPORT_SAVE_TIMEOUT_MS },
  );
  return data;
}

export async function submitHitReport(reportId: number): Promise<HitReport> {
  const { data } = await api.post<HitReport>(
    `/matchup/hit-reports/${reportId}/submit/`,
    {},
    { timeout: HIT_REPORT_SAVE_TIMEOUT_MS },
  );
  return data;
}

export function getHitReportPdfUrl(reportId: number): string {
  return `/api/v1/matchup/hit-reports/${reportId}/curated.pdf`;
}

// 카페·블로그 게시용 raw asset 다운로드 — 페이지별 PNG + summary.md + README.txt.
// PDF은 학원 제출용 정식 산출물 / ZIP은 강사가 카페에 paste·업로드용.
// 작성자 본인 또는 학원 owner/admin만 다운로드 가능 (다른 강사 자료 게시 차단).
export function getHitReportSharePackageUrl(reportId: number): string {
  return `/api/v1/matchup/hit-reports/${reportId}/share.zip`;
}

export async function deleteHitReport(reportId: number): Promise<void> {
  await api.delete(`/matchup/hit-reports/${reportId}/`);
}
