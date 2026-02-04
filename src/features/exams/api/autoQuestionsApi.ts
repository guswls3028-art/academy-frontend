// PATH: src/features/exams/api/autoQuestionsApi.ts
import { api } from "@/shared/api";
import { ExamQuestion } from "./questionApi";

export type Box = [number, number, number, number]; // [x,y,w,h]

export async function postAutoQuestions(sheetId: number, boxes: Box[]) {
  // backend: POST /exams/sheets/<sheet_id>/auto-questions/  { boxes: [[x,y,w,h], ...] }
  return api.post<ExamQuestion[]>(`/exams/sheets/${sheetId}/auto-questions/`, { boxes });
}
