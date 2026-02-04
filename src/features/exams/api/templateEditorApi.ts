// PATH: src/features/exams/api/templateEditorApi.ts
import { api } from "@/shared/api";

export interface TemplateEditorSummary {
  exam_id: number;
  title: string;
  subject: string;
  sheet_id: number;
  total_questions: number;
  has_answer_key: boolean;
  is_locked: boolean;
}

export interface TemplateValidationResult {
  template_exam_id: number;
  ok: boolean;
  reason?: string;
}

export function fetchTemplateEditor(examId: number) {
  return api.get<TemplateEditorSummary>(`/exams/${examId}/template-editor/`);
}

export function fetchTemplateValidation(examId: number) {
  return api.get<TemplateValidationResult>(
    `/exams/${examId}/template-validation/`
  );
}
