import api from "@/shared/api/axios";
import { isApiRecord } from "@/shared/api/response";
import { fetchAssessmentPages } from "@/shared/api/contracts/assessmentPages";
import type { Exam, ExamType } from "../types";
import { normalizeExam } from "./examNormalize";

/** The dashboard counts active regular exams; templates are reusable forms. */
export async function fetchActiveExamCount(): Promise<number> {
  const { data } = await api.get("/exams/", {
    params: { exam_type: "regular", page_size: 1 },
  });
  if (!isApiRecord(data) || typeof data.count !== "number" || !Number.isSafeInteger(data.count) || data.count < 0) {
    throw new Error("운영 중 시험 건수를 확인하지 못했습니다. 다시 조회해 주세요.");
  }
  return data.count;
}

/**
 * GET /exams/
 */
export async function fetchExams(params?: {
  exam_type?: ExamType;
  session_id?: number;
  lecture_id?: number;
}): Promise<Exam[]> {
  const items = await fetchAssessmentPages("/exams/", params);
  return items.map(normalizeExam);
}

/**
 * GET /exams/{id}/
 */
export async function fetchExam(
  examId: number
): Promise<Exam> {
  const res = await api.get(`/exams/${examId}/`);
  return normalizeExam(res.data);
}

/**
 * POST /exams/
 */
export async function createTemplateExam(
  payload: {
    title: string;
    subject: string;
    description?: string;
  }
): Promise<Exam> {
  const res = await api.post(`/exams/`, {
    title: payload.title,
    subject: payload.subject,
    description: payload.description ?? "",
    exam_type: "template",
  });

  return normalizeExam(res.data);
}

/**
 * POST /exams/
 */
export async function createRegularExam(
  payload: {
    title: string;
    template_exam_id: number;
    description?: string;
  }
): Promise<Exam> {
  const res = await api.post(`/exams/`, {
    title: payload.title,
    template_exam_id: payload.template_exam_id,
    description: payload.description ?? "",
    exam_type: "regular",
  });

  return normalizeExam(res.data);
}
