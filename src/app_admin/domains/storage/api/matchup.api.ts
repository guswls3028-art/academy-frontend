// PATH: src/app_admin/domains/storage/api/matchup.api.ts
// 매치업 API — 문서 업로드, 문제 조회, 유사 검색

import api from "@/shared/api/axios";

// ── Types ──

export type SegmentationMethod = "text" | "ocr" | "mixed" | "image" | "none";

export type MatchupDocumentMeta = {
  segmentation_method?: SegmentationMethod;
  upload_intent?: "reference" | "test";
  document_role?: "reference_material" | "exam_sheet";
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

export type MatchupProblem = {
  id: number;
  document_id: number;
  number: number;
  text: string;
  image_key: string;
  image_url?: string;
  meta: Record<string, unknown>;
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
}): Promise<MatchupDocument> {
  const form = new FormData();
  form.append("file", payload.file);
  if (payload.title) form.append("title", payload.title);
  if (payload.category) form.append("category", payload.category);
  if (payload.subject) form.append("subject", payload.subject);
  if (payload.grade_level) form.append("grade_level", payload.grade_level);
  form.append("intent", payload.intent ?? "reference");

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
  payload: { title?: string; category?: string; subject?: string; grade_level?: string; intent?: "reference" | "test" },
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
