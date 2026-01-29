// ======================================================================================
// FILE: src/features/materials/sheets/sheets.api.ts  (UPDATE)
// ======================================================================================
import {
  listSheets,
  getSheet,
  createSheet,
  type SheetEntity,
} from "@/features/materials/api/sheets";

import {
  getSheetQuestions,
  patchSheetQuestionScore,
  type SheetQuestionEntity,
} from "@/features/materials/api/sheetQuestions";

import {
  getSheetAnswerKey,
  upsertSheetAnswerKey,
  type AnswerKeyEntity,
} from "@/features/materials/api/answerKeys";

export type { SheetEntity, SheetQuestionEntity, AnswerKeyEntity };

export type OmrObjectiveV1Meta = {
  version: "objective_v1";
  units: "mm";
  question_count: 10 | 20 | 30;
  page: {
    orientation: "landscape";
    size: { width: number; height: number };
  };
  identifier?: {
    digits: Array<{
      digit: number;
      bubbles: Array<{
        number: number;
        center: { x: number; y: number };
        radius: number;
      }>;
    }>;
  };
  questions: Array<{
    question_number: number;
    axis: "x" | "y";
    roi: { x: number; y: number; w: number; h: number };
    choices: Array<{
      choice: "A" | "B" | "C" | "D" | "E";
      center: { x: number; y: number };
      radius: number;
    }>;
  }>;
};

// ===== Sheets (materials 단일진실) =====
export async function listSheetsApi(): Promise<SheetEntity[]> {
  return await listSheets();
}

export async function getSheetApi(sheetId: number): Promise<SheetEntity | null> {
  return await getSheet(sheetId);
}

export async function createSheetApi(input: {
  title: string;
  questionCount: 10 | 20 | 30;
  mode: "preset" | "custom";
}): Promise<SheetEntity> {
  return await createSheet(input);
}

// ===== SheetQuestions (materials 단일진실) =====
export async function getSheetQuestionsApi(sheetId: number): Promise<SheetQuestionEntity[]> {
  return await getSheetQuestions(sheetId);
}

export async function patchSheetQuestionScoreApi(input: { questionId: number; score: number }) {
  return await patchSheetQuestionScore(input);
}

// ===== AnswerKey (materials 단일진실) =====
export async function getSheetAnswerKeyApi(sheetId: number): Promise<AnswerKeyEntity | null> {
  return await getSheetAnswerKey(sheetId);
}

export async function upsertSheetAnswerKeyApi(input: {
  sheetId: number;
  existingId?: number | null;
  answers: Record<string, string>;
}) {
  return await upsertSheetAnswerKey(input);
}

/**
 * OMR meta / PDF (materials 책임)
 * - 엔드포인트는 v1 계약대로 유지
 */
export async function fetchOmrObjectiveV1Meta(questionCount: 10 | 20 | 30): Promise<OmrObjectiveV1Meta> {
  const url = `/api/v1/assets/omr/objective/meta/?question_count=${questionCount}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "OMR meta 조회 실패");
  }
  const data = (await res.json().catch(() => null)) as OmrObjectiveV1Meta | null;
  if (!data?.version) throw new Error("OMR meta 조회 실패");
  return data;
}

export async function generateOmrObjectiveV1Pdf(input: { logo_asset_id?: string | null } = {}) {
  const res = await fetch("/api/v1/assets/omr/objective/pdf/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(input.logo_asset_id ? { logo_asset_id: input.logo_asset_id } : {}) }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "OMR PDF 생성 실패");
  }
  return res;
}
