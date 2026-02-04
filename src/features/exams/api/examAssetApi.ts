// PATH: src/features/exams/api/examAssetApi.ts
import { api } from "@/shared/api";

export type ExamAssetType = "problem_pdf" | "omr_sheet";

export interface ExamAsset {
  id: number;
  exam: number; // template exam id
  asset_type: ExamAssetType;
  file_key: string;
  file_type?: string | null;
  file_size?: number | null;
  download_url: string;
  created_at: string;
  updated_at: string;
}

export async function fetchExamAssets(examId: number) {
  // backend: GET /exams/<exam_id>/assets/ -> resolves template if regular
  return api.get<ExamAsset[]>(`/exams/${examId}/assets/`);
}

export async function uploadExamAsset(params: {
  examId: number;
  assetType: ExamAssetType;
  file: File;
}) {
  // backend: POST /exams/<exam_id>/assets/ (template only, locked check)
  const fd = new FormData();
  fd.append("asset_type", params.assetType);
  fd.append("file", params.file);

  return api.post<ExamAsset>(`/exams/${params.examId}/assets/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
