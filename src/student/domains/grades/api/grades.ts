// PATH: src/student/domains/grades/api/grades.ts

import api from "@/student/shared/api/studentApi";

export type MyExamGradeSummary = {
  exam_id: number;
  enrollment_id: number;
  title: string;
  total_score: number;
  max_score: number;
  is_pass: boolean;
  session_title: string | null;
  lecture_title: string | null;
  submitted_at: string | null;
};

export type MyHomeworkGradeSummary = {
  homework_id: number;
  enrollment_id: number;
  title: string;
  score: number;
  max_score: number | null;
  passed: boolean;
  session_title: string | null;
  lecture_title: string | null;
};

export type MyGradesSummary = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
};

export async function fetchMyGradesSummary(): Promise<MyGradesSummary> {
  const res = await api.get("/student/grades/");
  const data = res.data ?? {};
  return {
    exams: Array.isArray(data.exams) ? data.exams : [],
    homeworks: Array.isArray(data.homeworks) ? data.homeworks : [],
  };
}
