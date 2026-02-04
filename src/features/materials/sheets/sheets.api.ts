// PATH: src/features/materials/sheets/sheets.api.ts
import api from "@/shared/api/axios";
import axios from "axios";

import {
  listSheets,
  getSheet,
  createSheet,
  type SheetEntity,
} from "@/features/materials/api/sheets";

import {
  getExamQuestions,
  patchQuestionScore,
  type SheetQuestionEntity,
} from "@/features/materials/api/sheetQuestions";

import {
  getExamAnswerKey,
  upsertExamAnswerKey,
  type AnswerKeyEntity,
} from "@/features/materials/api/answerKeys";

// ✅ Submissions domain SSOT wrapper (materials 내부에서만 사용)
import {
  listExamSubmissionsApi,
  manualEditSubmissionApi,
  retrySubmissionApi,
  uploadOmrBatchApi,
  type ExamSubmissionRow,
  type SubmissionManualEditInput,
} from "./components/submissions/submissions.api";

/* =====================================================================================
 * TYPES
 * ===================================================================================== */

export type { SheetEntity, SheetQuestionEntity, AnswerKeyEntity };

// ✅ submissions tab types re-export (Sheets 탭에서 사용)
export type { ExamSubmissionRow, SubmissionManualEditInput };

/**
 * ✅ SSOT (backend commentary in exams):
 * - OMR meta/layout/좌표 SSOT는 assets endpoint
 * - exams는 question_count를 확정하고 assets meta를 참조/소비
 *
 * 현재 프론트는 auto-questions(문항 bbox 생성) 목적으로 meta를 사용하되,
 * exams의 운영 스펙에 맞춰 question_count는 10|20|30만 허용한다.
 *
 * objective_v1 meta는 최소한 아래 필드를 가진다:
 * {
 *   version: "objective_v1",
 *   question_count: number,
 *   page: {...},
 *   identifier: ...,
 *   questions: [{ question_number, axis, roi:{x,y,w,h}, choices:[...] }]
 * }
 */
export type OmrObjectiveMetaV1 = {
  version: "objective_v1" | string;
  units?: string;
  question_count: number;
  page?: any;
  identifier?: any;
  questions: Array<{
    question_number: number;
    axis?: "x" | "y";
    roi: { x: number; y: number; w: number; h: number };
    choices?: any[];
  }>;
};

export type TemplateEditorSummary = {
  exam_id: number;
  title: string;
  subject: string;
  sheet_id: number;
  total_questions: number;
  has_answer_key: boolean;
  is_locked: boolean;
};

export type TemplateValidationResult =
  | { template_exam_id: number; ok: true }
  | { template_exam_id: number; ok: false; reason: string };

export type ExamAssetEntity = {
  id: number;
  exam: number;
  asset_type: "problem_pdf" | "omr_sheet";
  file_key: string;
  file_type?: string | null;
  file_size?: number | null;
  download_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

/* =====================================================================================
 * INTERNAL HELPERS
 * ===================================================================================== */

function pickSheetId(anyData: any): number | null {
  const candidates = [
    anyData?.sheet_id,
    anyData?.sheetId,
    anyData?.sheet?.id,
    anyData?.sheet?.pk,
    anyData?.sheet?.sheet_id,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function resolveSheetIdByExamId(examId: number): Promise<number> {
  // 1) template-editor가 살아있으면 가장 확실
  const summary = await getTemplateEditorSummaryApi(examId).catch(() => null);
  const s1 = pickSheetId(summary);
  if (s1) return s1;

  // 2) exam detail에서 sheet_id 추출 시도(서버가 내려주는 경우만)
  const res = await api.get(`/exams/${examId}/`);
  const s2 = pickSheetId(res.data);
  if (s2) return s2;

  throw new Error("sheet_id를 찾을 수 없습니다. (builder 초기화/서버 응답 확인 필요)");
}

function buildQuestionRoiBoxesFromMetaV1(meta: OmrObjectiveMetaV1): Array<[number, number, number, number]> {
  // ✅ exams auto-questions는 boxes([x,y,w,h])를 받는다.
  // ✅ objective_v1 meta는 question 단위 roi를 제공하므로 그대로 변환한다.
  const boxes: Array<[number, number, number, number]> = [];

  for (const q of meta.questions ?? []) {
    const roi = q?.roi;
    if (!roi) continue;

    const x = Number(roi.x);
    const y = Number(roi.y);
    const w = Number(roi.w);
    const h = Number(roi.h);

    if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;

    // backend serializer는 integer로 받는다.
    boxes.push([Math.round(x), Math.round(y), Math.round(w), Math.round(h)]);
  }

  return boxes;
}

async function postAutoQuestionsBySheetId(sheetId: number, questionCount: 10 | 20 | 30) {
  const meta = await fetchOmrObjectiveMeta(questionCount);

  const boxes = buildQuestionRoiBoxesFromMetaV1(meta);

  await api.post(`/exams/sheets/${sheetId}/auto-questions/`, {
    boxes,
  });
}

/* =====================================================================================
 * SHEETS (TEMPLATE EXAM = MATERIALS SSOT)
 * ===================================================================================== */

export async function listSheetsApi(): Promise<SheetEntity[]> {
  return await listSheets();
}

export async function getSheetApi(sheetId: number): Promise<SheetEntity | null> {
  return await getSheet(sheetId);
}

export async function createSheetApi(input: {
  title: string;
  subject: string;
  questionCount: 10 | 20 | 30;
  mode: "preset" | "custom";
}): Promise<SheetEntity> {
  if (input.mode !== "preset") {
    throw new Error("커스텀 업로드는 아직 비활성화되어 있습니다.");
  }

  // 1) template exam 생성 (SSOT)
  const created = await createSheet({
    title: input.title,
    subject: input.subject,
  });

  const examId = Number((created as any)?.id);
  if (!Number.isFinite(examId) || examId <= 0) {
    throw new Error("시험지 생성 실패");
  }

  // 2) builder로 sheet/answer_key 등 초기화 (SSOT)
  const builderRes = await api.post(`/exams/${examId}/builder/`);
  const builderData = builderRes?.data;

  // 3) sheet_id 확보 (builder 우선)
  const sheetId =
    pickSheetId(builderData) ||
    pickSheetId(created) ||
    (await resolveSheetIdByExamId(examId));

  // 4) preset이면 meta(assets objective_v1) 기반 문항 자동 생성
  await postAutoQuestionsBySheetId(sheetId, input.questionCount);

  return created;
}

/* =====================================================================================
 * QUESTIONS / ANSWERS
 * ===================================================================================== */

export async function getSheetQuestionsApi(examId: number): Promise<SheetQuestionEntity[]> {
  return await getExamQuestions(examId);
}

export async function patchSheetQuestionScoreApi(input: { questionId: number; score: number }) {
  return await patchQuestionScore(input);
}

export async function getSheetAnswerKeyApi(examId: number): Promise<AnswerKeyEntity | null> {
  return await getExamAnswerKey(examId);
}

export async function upsertSheetAnswerKeyApi(input: {
  sheetId: number; // historical name: 실제로는 examId를 받는다(자료실은 template list)
  existingId?: number | null;
  answers: Record<string, string>;
}) {
  return await upsertExamAnswerKey({
    examId: input.sheetId,
    existingId: input.existingId,
    answers: input.answers,
  });
}

/* =====================================================================================
 * TEMPLATE STATUS
 * ===================================================================================== */

export async function getTemplateEditorSummaryApi(examId: number): Promise<TemplateEditorSummary | null> {
  try {
    const res = await api.get(`/exams/${examId}/template-editor/`);
    return res.data as TemplateEditorSummary;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const s = err.response?.status;
      if (s === 400 || s === 404) return null;
    }
    throw err;
  }
}

export async function getTemplateValidationApi(examId: number): Promise<TemplateValidationResult | null> {
  try {
    const res = await api.get(`/exams/${examId}/template-validation/`);
    return res.data as TemplateValidationResult;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const s = err.response?.status;
      if (s === 400 || s === 404) return null;
    }
    throw err;
  }
}

/* =====================================================================================
 * ASSETS (OMR / PROBLEM PDF) — exams endpoints
 * ===================================================================================== */

export async function listExamAssetsApi(examId: number): Promise<ExamAssetEntity[]> {
  const res = await api.get(`/exams/${examId}/assets/`);
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export async function uploadExamAssetApi(input: {
  examId: number;
  assetType: "problem_pdf";
  file: File;
}): Promise<ExamAssetEntity> {
  const fd = new FormData();
  fd.append("asset_type", input.assetType);
  fd.append("file", input.file);

  const res = await api.post(`/exams/${input.examId}/assets/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as ExamAssetEntity;
}

/**
 * ✅ SSOT (backend exams):
 * POST /exams/<template_exam_id>/generate-omr/
 * - question_count: 10|20|30
 */
export async function generateOmrSheetAssetApi(input: {
  templateExamId: number;
  questionCount: 10 | 20 | 30;
}): Promise<ExamAssetEntity> {
  const res = await api.post(`/exams/${input.templateExamId}/generate-omr/`, {
    question_count: input.questionCount,
  });
  return res.data as ExamAssetEntity;
}

/**
 * ✅ "문항 없음" 상태를 운영자 화면에서 즉시 복구하기 위한 버튼 API
 * - exams auto-questions는 sheet_id가 필요하므로, template-editor를 통해 sheet_id를 resolve한다.
 * - questionCount는 10|20|30만 허용(운영 스펙)
 */
export async function autoGenerateQuestionsApi(input: {
  templateExamId: number;
  questionCount: 10 | 20 | 30;
}) {
  const sheetId = await resolveSheetIdByExamId(input.templateExamId);
  await postAutoQuestionsBySheetId(sheetId, input.questionCount);
  return { sheetId };
}

/* =====================================================================================
 * META (assets objective_v1) — UI/auto-questions 입력용
 * ===================================================================================== */

export async function fetchOmrObjectiveMeta(questionCount: 10 | 20 | 30): Promise<OmrObjectiveMetaV1> {
  const res = await fetch(`/api/v1/assets/omr/objective/meta/?question_count=${questionCount}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as OmrObjectiveMetaV1;
}

/* =====================================================================================
 * SUBMISSIONS (domains/submissions SSOT)
 * ===================================================================================== */

export async function listExamSubmissions(examId: number) {
  return await listExamSubmissionsApi(examId);
}

export async function manualEditSubmission(input: SubmissionManualEditInput) {
  return await manualEditSubmissionApi(input);
}

export async function retrySubmission(submissionId: number) {
  return await retrySubmissionApi(submissionId);
}

export async function uploadOmrBatch(input: { examId: number; files: File[]; sheetId?: number | string | null }) {
  return await uploadOmrBatchApi(input);
}
