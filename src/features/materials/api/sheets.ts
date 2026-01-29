// ======================================================================================
// FILE: src/features/materials/api/sheets.ts  (ADD)
// ======================================================================================
import api from "@/shared/api/axios";

export type SheetEntity = {
  id: number;
  title?: string | null;
  created_at?: string | null;
};

function normalizeList(data: any): SheetEntity[] {
  if (Array.isArray(data)) return data as SheetEntity[];
  if (Array.isArray(data?.items)) return data.items as SheetEntity[];
  if (Array.isArray(data?.results)) return data.results as SheetEntity[];
  return [];
}

/**
 * materials(단일진실) 내부에서 "시험지 상품"을 조회/생성한다.
 * - 백엔드 엔드포인트가 /exams/ 라도 프론트 도메인 경계는 유지한다.
 */
export async function listSheets(): Promise<SheetEntity[]> {
  const res = await api.get("/exams/");
  return normalizeList(res.data);
}

export async function getSheet(sheetId: number): Promise<SheetEntity | null> {
  if (!Number.isFinite(sheetId) || sheetId <= 0) return null;
  const res = await api.get(`/exams/${sheetId}/`);
  return (res.data as any) ?? null;
}

export async function createSheet(input: {
  title: string;
  questionCount: 10 | 20 | 30;
  mode: "preset" | "custom";
}): Promise<SheetEntity> {
  const res = await api.post("/exams/", {
    title: input.title,
    question_count: input.questionCount,
    mode: input.mode,
  });

  const data = res.data as any;
  if (!data?.id) {
    throw new Error("시험지 생성 실패");
  }
  return data as SheetEntity;
}
