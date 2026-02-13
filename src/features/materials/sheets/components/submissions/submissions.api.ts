// PATH: src/features/materials/sheets/components/submissions/submissions.api.ts
// SSOT ALIGN (backend domains/submissions):
// - list:    GET  /submissions/exams/<exam_id>/
// - retry:   POST /submissions/submissions/<submission_id>/retry/
// - manual:  POST /submissions/submissions/<submission_id>/manual-edit/
// - batch:   POST /submissions/exams/<exam_id>/omr/batch/  (multipart, files[])

import api from "@/shared/api/axios";
import type { SubmissionStatus } from "@/features/submissions/types";

/** 백엔드가 구형 pending/processing 반환 시 대비 */
export type ExamSubmissionRow = {
  id: number;
  enrollment_id: number;
  student_name: string;
  status: SubmissionStatus | "pending" | "processing";
  score: number | null;
  created_at: string;
};

export type SubmissionManualEditInput = {
  submissionId: number;
  identifier?: any;
  note?: string;
  answers: Array<{
    exam_question_id: number;
    answer: string;
  }>;
};

export async function listExamSubmissionsApi(examId: number): Promise<ExamSubmissionRow[]> {
  if (!Number.isFinite(examId) || examId <= 0) return [];
  const res = await api.get(`/submissions/exams/${examId}/`);
  const data = res.data;
  if (Array.isArray(data)) return data as ExamSubmissionRow[];
  if (Array.isArray(data?.items)) return data.items as ExamSubmissionRow[];
  if (Array.isArray(data?.results)) return data.results as ExamSubmissionRow[];
  return [];
}

export async function retrySubmissionApi(submissionId: number) {
  if (!Number.isFinite(submissionId) || submissionId <= 0) {
    throw new Error("유효하지 않은 submissionId");
  }
  // router: /submissions/submissions/<pk>/retry/
  const res = await api.post(`/submissions/submissions/${submissionId}/retry/`, {});
  return res.data;
}

export async function manualEditSubmissionApi(input: SubmissionManualEditInput) {
  const sid = Number(input.submissionId);
  if (!Number.isFinite(sid) || sid <= 0) {
    throw new Error("유효하지 않은 submissionId");
  }

  const answers = (input.answers ?? [])
    .filter((a) => a && Number.isFinite(Number(a.exam_question_id)) && String(a.answer ?? "").length >= 0)
    .map((a) => ({
      exam_question_id: Number(a.exam_question_id),
      answer: String(a.answer ?? ""),
    }));

  const payload: any = {
    identifier: input.identifier,
    answers,
    note: String(input.note || "manual_edit"),
  };

  // router: /submissions/submissions/<pk>/manual-edit/
  const res = await api.post(`/submissions/submissions/${sid}/manual-edit/`, payload);
  return res.data;
}

export async function uploadOmrBatchApi(input: { examId: number; files: File[]; sheetId?: number | string | null }) {
  const examId = Number(input.examId);
  if (!Number.isFinite(examId) || examId <= 0) throw new Error("유효하지 않은 examId");

  const files = input.files ?? [];
  if (!Array.isArray(files) || files.length === 0) throw new Error("files required");

  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  if (input.sheetId != null && String(input.sheetId).length > 0) {
    fd.append("sheet_id", String(input.sheetId));
  }

  // urls.py: /submissions/exams/<exam_id>/omr/batch/
  const res = await api.post(`/submissions/exams/${examId}/omr/batch/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}
