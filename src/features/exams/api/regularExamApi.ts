// PATH: src/features/exams/api/regularExamApi.ts
import { api } from "@/shared/api";
import { Exam } from "./examApi";

export async function createRegularExam(params: {
  title: string;
  description?: string;
  template_exam_id: number;
  session_id: number;
}) {
  return api.post<Exam>("/exams/", {
    exam_type: "regular",
    title: params.title,
    description: params.description,
    template_exam_id: params.template_exam_id,
    session_id: params.session_id,
  });
}
