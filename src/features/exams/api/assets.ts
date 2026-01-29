import api from "@/shared/api/axios";

export type ExamAssetType = "problem_pdf" | "omr_sheet";

export interface ExamAsset {
  id: number;
  exam: number;
  asset_type: ExamAssetType;
  file_key: string;
  file_type: string | null;
  file_size: number | null;
  download_url: string;
  created_at?: string;
}

function normalizeList(data: any): ExamAsset[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * GET /api/v1/exams/{id}/assets/
 */
export async function fetchExamAssets(
  examId: number
): Promise<ExamAsset[]> {
  const res = await api.get(`/exams/${examId}/assets/`);
  return normalizeList(res.data);
}
