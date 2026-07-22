import api from "@/shared/api/axios";
import { downloadBlob } from "@/shared/utils/safeDownload";

export type ExamResultImportLecture = {
  id?: number | null;
  lecture_name?: string | null;
  color?: string | null;
  chip_label?: string | null;
};

export type ExamResultImportRow = {
  row: number;
  enrollment_id: number;
  student_name: string;
  lectures: ExamResultImportLecture[];
  correct_count: number;
  wrong_count: number;
  wrong_questions: number[];
  total_score: number;
  max_score: number;
  will_overwrite: boolean;
};

export type ExamResultImportIssue = {
  row: number | null;
  field: string;
  message: string;
};

export type ExamResultImportPreview = {
  ok: boolean;
  applied: boolean;
  exam_id: number;
  exam_title: string;
  filename: string;
  question_count: number;
  matched_count: number;
  overwrite_count: number;
  errors: ExamResultImportIssue[];
  warnings: string[];
  rows: ExamResultImportRow[];
};

export async function downloadExamResultTemplate(
  examId: number,
  examTitle: string,
): Promise<void> {
  const response = await api.get<Blob>(
    `/results/admin/exams/${examId}/result-import/template/`,
    { responseType: "blob", timeout: 60_000 },
  );
  const safeTitle = String(examTitle || "시험")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  downloadBlob(response.data, `${safeTitle}_문항별_채점결과.xlsx`);
}

export async function previewExamResultImport(
  examId: number,
  file: File,
): Promise<ExamResultImportPreview> {
  return submitExamResultImport(examId, file, false);
}

export async function applyExamResultImport(
  examId: number,
  file: File,
): Promise<ExamResultImportPreview> {
  return submitExamResultImport(examId, file, true);
}

async function submitExamResultImport(
  examId: number,
  file: File,
  apply: boolean,
): Promise<ExamResultImportPreview> {
  const form = new FormData();
  form.append("file", file);
  if (apply) form.append("apply", "true");
  const response = await api.post<ExamResultImportPreview>(
    `/results/admin/exams/${examId}/result-import/`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000,
    },
  );
  return response.data;
}
