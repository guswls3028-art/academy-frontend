// PATH: src/student/domains/grades/api/grades.ts

import api from "@/student/shared/api/studentApi";

/** achievement: PASS=1차합격, REMEDIATED=보강후합격, FAIL=불합격 */
export type Achievement = "PASS" | "REMEDIATED" | "FAIL";

export type MyExamGradeSummary = {
  exam_id: number;
  enrollment_id: number;
  title: string;
  total_score: number;
  max_score: number;
  is_pass: boolean | null;  // null = 합격 기준 미설정
  achievement?: Achievement | null;
  retake_count?: number;
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
  achievement?: Achievement;
  retake_count?: number;
  session_title: string | null;
  lecture_title: string | null;
};

export type MyGradesSummary = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
};

export async function fetchMyGradesSummary(): Promise<MyGradesSummary> {
  const res = await api.get("/student/grades/");
  const data: any = res.data ?? {};
  return {
    exams: Array.isArray(data.exams) ? data.exams : [],
    homeworks: Array.isArray(data.homeworks) ? data.homeworks : [],
  };
}
