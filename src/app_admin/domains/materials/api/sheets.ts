// PATH: src/app_admin/domains/materials/api/sheets.ts
import api from "@/shared/api/axios";
import {
  booleanFromApiValue,
  isApiRecord,
  listFromApiResponse,
  numberFromApiValue,
  stringFromApiValue,
} from "./normalizers";

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

function examTypeFromApiValue(value: unknown): SheetEntity["exam_type"] | undefined {
  return value === "template" || value === "regular" ? value : undefined;
}

function normalizeSheetEntity(value: unknown): SheetEntity | null {
  if (!isApiRecord(value)) return null;
  const id = numberFromApiValue(value.id);
  if (!id || id <= 0) return null;

  return {
    id,
    title: stringFromApiValue(value.title),
    description: stringFromApiValue(value.description),
    subject: stringFromApiValue(value.subject),
    exam_type: examTypeFromApiValue(value.exam_type),
    is_active: booleanFromApiValue(value.is_active),
    allow_retake: booleanFromApiValue(value.allow_retake),
    max_attempts: numberFromApiValue(value.max_attempts),
    pass_score: numberFromApiValue(value.pass_score),
    open_at: stringFromApiValue(value.open_at),
    close_at: stringFromApiValue(value.close_at),
    created_at: stringFromApiValue(value.created_at),
    updated_at: stringFromApiValue(value.updated_at),
  };
}

function normalizeList(data: unknown): SheetEntity[] {
  return listFromApiResponse(data).map(normalizeSheetEntity).filter((sheet): sheet is SheetEntity => sheet !== null);
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
  return normalizeSheetEntity(res.data);
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

  const data = normalizeSheetEntity(res.data);
  if (!data) throw new Error("시험지 생성 실패");
  return data;
}
