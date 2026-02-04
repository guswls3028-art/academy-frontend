// PATH: src/features/materials/api/sheets.ts
import api from "@/shared/api/axios";

export type SheetEntity = {
  id: number; // ✅ backend Exam.id (template/regular)
  title?: string | null;
  description?: string | null;
  subject?: string | null;
  exam_type?: "template" | "regular";
  is_active?: boolean | null;
  allow_retake?: boolean | null;
  max_attempts?: number | null;
  pass_score?: number | null;
  open_at?: string | null;
  close_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizeList(data: any): SheetEntity[] {
  if (Array.isArray(data)) return data as SheetEntity[];
  if (Array.isArray(data?.items)) return data.items as SheetEntity[];
  if (Array.isArray(data?.results)) return data.results as SheetEntity[];
  return [];
}

/**
 * materials(단일진실) 내부에서 "시험지 상품(=template exam)"을 조회/생성한다.
 * - 백엔드 엔드포인트는 /exams/
 * - SSOT: template exam이 Sheet/Question/AnswerKey/Asset의 단일 진실
 */
export async function listSheets(): Promise<SheetEntity[]> {
  // template만 자료실에 노출
  const res = await api.get("/exams/", { params: { exam_type: "template" } });
  return normalizeList(res.data);
}

export async function getSheet(sheetId: number): Promise<SheetEntity | null> {
  if (!Number.isFinite(sheetId) || sheetId <= 0) return null;
  const res = await api.get(`/exams/${sheetId}/`);
  return (res.data as any) ?? null;
}

export async function createSheet(input: {
  title: string;
  subject: string; // ✅ template 생성에는 subject 필수 (백엔드 계약)
  description?: string;
}): Promise<SheetEntity> {
  const res = await api.post("/exams/", {
    title: input.title,
    description: input.description ?? "",
    subject: input.subject,
    exam_type: "template",
  });

  const data = res.data as any;
  if (!data?.id) throw new Error("시험지 생성 실패");
  return data as SheetEntity;
}
