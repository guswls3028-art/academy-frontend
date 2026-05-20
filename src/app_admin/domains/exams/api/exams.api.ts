import api from "@/shared/api/axios";
import { isApiRecord } from "@/shared/api/response";
import type { Exam, ExamType } from "../types";
import { normalizeExam } from "./examNormalize";

/**
 * GET /exams/
 */
export async function fetchExams(params?: {
  exam_type?: ExamType;
  session_id?: number;
  lecture_id?: number;
}): Promise<Exam[]> {
  const res = await api.get(`/exams/`, { params });

  const data = res.data;

  const items = Array.isArray(data)
    ? data
    : isApiRecord(data) && Array.isArray(data.results)
    ? data.results
    : isApiRecord(data) && Array.isArray(data.items)
    ? data.items
    : [];

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
