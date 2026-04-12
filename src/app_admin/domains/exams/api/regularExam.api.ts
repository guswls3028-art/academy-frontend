// PATH: src/app_admin/domains/exams/api/regularExam.api.ts
import api from "@/shared/api/axios";
import { Exam } from "../types";

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
