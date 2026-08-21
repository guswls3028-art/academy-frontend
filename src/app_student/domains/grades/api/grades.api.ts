// PATH: src/app_student/domains/grades/api/grades.ts

import api from "@student/shared/api/student.api";
import type {
  StudentExamSummary,
  StudentExamTrendPoint,
  StudentScoreLectureOption,
} from "@/shared/api/contracts/studentGrades";
import {
  normalizeStudentGradeReportLayout,
  type StudentGradeReportLayout,
} from "@/shared/api/contracts/studentGradeReportLayout";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";

/** achievement: PASS=1차합격, REMEDIATED=보강후합격, FAIL=불합격, NOT_SUBMITTED=미응시 */
export type Achievement = "PASS" | "REMEDIATED" | "FAIL" | "NOT_SUBMITTED";

export type MyExamGradeSummary = {
  exam_id: number;
  enrollment_id: number;
  session_id?: number | null;
  title: string;
  total_score: number | null;  // null = 미응시
  max_score: number;
  is_pass: boolean | null;  // null = 합격 기준 미설정 또는 미응시
  achievement?: Achievement | null;
  meta_status?: string | null;  // "NOT_SUBMITTED" = 미응시
  retake_count?: number;
  session_title: string | null;
  lecture_title: string | null;
  submitted_at: string | null;
  // 석차 정보
  rank?: number | null;
  percentile?: number | null;
  cohort_size?: number | null;
  cohort_avg?: number | null;
  total_questions?: number;
  correct_count?: number;
  wrong_count?: number;
  accuracy_rate?: number | null;
  wrong_question_numbers?: number[];
  correction_status?: "PENDING" | "COMPLETED" | "NOT_REQUIRED" | null;
};

export type MyHomeworkGradeSummary = {
  homework_id: number;
  enrollment_id: number;
  title: string;
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
  meta_status?: string | null;
  achievement?: Achievement | null;
  retake_count?: number;
  grading_mode?: "SCORE" | "COMPLETION";
  display_order?: number;
  session_id?: number | null;
  session_title: string | null;
  session_order?: number | null;
  session_regular_order?: number | null;
  session_type?: "REGULAR" | "SUPPLEMENT" | null;
  lecture_id?: number | null;
  lecture_title: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  recorded_at?: string | null;
};

export type MyGradesSummary = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
  exam_trend: StudentExamTrendPoint[];
  exam_summary: StudentExamSummary;
  lecture_options: StudentScoreLectureOption[];
  /** 학원장이 커스텀한 합/불 라벨. 빈 문자열이면 GradeBadge 기본값 사용. */
  labels?: { pass?: string; fail?: string };
  report_layout: StudentGradeReportLayout;
};

const EMPTY_EXAM_SUMMARY: StudentExamSummary = {
  scored_count: 0,
  average_score_pct: null,
  latest_score_pct: null,
  change_pct_points: null,
  best_score_pct: null,
};

function plainOptional(value: string | null | undefined): string | null | undefined {
  return value == null ? value : richHtmlToPlainText(value);
}

function normalizeExamGrade(exam: MyExamGradeSummary): MyExamGradeSummary {
  return {
    ...exam,
    title: richHtmlToPlainText(exam.title),
    session_title: plainOptional(exam.session_title) ?? null,
    lecture_title: plainOptional(exam.lecture_title) ?? null,
  };
}

function normalizeHomeworkGrade(homework: MyHomeworkGradeSummary): MyHomeworkGradeSummary {
  return {
    ...homework,
    title: richHtmlToPlainText(homework.title),
    session_title: plainOptional(homework.session_title) ?? null,
    lecture_title: plainOptional(homework.lecture_title) ?? null,
  };
}

export type MyGradesAnalytics = {
  student?: { id: number; name: string };
  date_range?: { days: number; from: string | null; to: string | null };
  summary: {
    exam_count: number;
    scored_exam_count: number;
    avg_score_pct: number | null;
    median_score_pct: number | null;
    p25_score_pct?: number | null;
    p75_score_pct?: number | null;
    pass_rate_pct: number | null;
    not_submitted_count: number;
    risk_level: "insufficient" | "attention" | "watch" | "stable" | string;
    generated_at?: string;
  };
  trends: Array<{
    exam_id: number;
    title: string;
    lecture_title: string | null;
    submitted_at: string | null;
    score_pct: number | null;
    cohort_avg_pct: number | null;
    rank: number | null;
    percentile: number | null;
    cohort_size: number | null;
  }>;
  lecture_breakdown: Array<{
    lecture_title: string;
    exam_count: number;
    avg_score_pct: number | null;
  }>;
  weak_questions: Array<{
    question_number: number;
    wrong_count: number;
  }>;
  homework: {
    assigned_count: number;
    graded_count: number;
    avg_score_pct: number | null;
    pass_rate_pct: number | null;
  };
  highlights: {
    latest_exam: { exam_id: number; title: string; score_pct: number | null } | null;
    best_exam: { exam_id: number; title: string; score_pct: number | null } | null;
    weakest_exam: { exam_id: number; title: string; score_pct: number | null } | null;
  };
  insights: string[];
  data_quality?: {
    filtered_test_exam_count: number;
  };
};

export async function fetchMyGradesSummary(): Promise<MyGradesSummary> {
  const res = await api.get<Partial<MyGradesSummary>>("/student/grades/");
  const data = res.data ?? {};
  return {
    exams: Array.isArray(data.exams) ? data.exams.map(normalizeExamGrade) : [],
    homeworks: Array.isArray(data.homeworks) ? data.homeworks.map(normalizeHomeworkGrade) : [],
    exam_trend: Array.isArray(data.exam_trend)
      ? data.exam_trend.map((point) => ({
          ...point,
          title: richHtmlToPlainText(point.title),
          session_title: plainOptional(point.session_title) ?? null,
          lecture_title: plainOptional(point.lecture_title) ?? null,
          lecture_chip_label: plainOptional(point.lecture_chip_label) ?? null,
        }))
      : [],
    exam_summary: data.exam_summary ?? EMPTY_EXAM_SUMMARY,
    lecture_options: Array.isArray(data.lecture_options)
      ? data.lecture_options.map((lecture) => ({
          ...lecture,
          title: richHtmlToPlainText(lecture.title),
          chip_label: plainOptional(lecture.chip_label) ?? null,
        }))
      : [],
    labels: data.labels
      ? {
          pass: plainOptional(data.labels.pass) ?? undefined,
          fail: plainOptional(data.labels.fail) ?? undefined,
        }
      : undefined,
    report_layout: normalizeStudentGradeReportLayout(data.report_layout),
  };
}

export async function fetchMyGradesAnalytics(): Promise<MyGradesAnalytics> {
  const res = await api.get<MyGradesAnalytics>("/student/grades/analytics/");
  const data = res.data;
  return {
    ...data,
    student: data.student
      ? { ...data.student, name: richHtmlToPlainText(data.student.name) }
      : data.student,
    summary: data.summary ?? {
      exam_count: 0,
      scored_exam_count: 0,
      avg_score_pct: null,
      median_score_pct: null,
      pass_rate_pct: null,
      not_submitted_count: 0,
      risk_level: "insufficient",
    },
    trends: Array.isArray(data.trends)
      ? data.trends.map((trend) => ({
          ...trend,
          title: richHtmlToPlainText(trend.title),
          lecture_title: plainOptional(trend.lecture_title) ?? null,
        }))
      : [],
    lecture_breakdown: Array.isArray(data.lecture_breakdown)
      ? data.lecture_breakdown.map((lecture) => ({
          ...lecture,
          lecture_title: richHtmlToPlainText(lecture.lecture_title),
        }))
      : [],
    weak_questions: Array.isArray(data.weak_questions) ? data.weak_questions : [],
    homework: data.homework ?? {
      assigned_count: 0,
      graded_count: 0,
      avg_score_pct: null,
      pass_rate_pct: null,
    },
    highlights: data.highlights
      ? {
          latest_exam: data.highlights.latest_exam
            ? { ...data.highlights.latest_exam, title: richHtmlToPlainText(data.highlights.latest_exam.title) }
            : null,
          best_exam: data.highlights.best_exam
            ? { ...data.highlights.best_exam, title: richHtmlToPlainText(data.highlights.best_exam.title) }
            : null,
          weakest_exam: data.highlights.weakest_exam
            ? { ...data.highlights.weakest_exam, title: richHtmlToPlainText(data.highlights.weakest_exam.title) }
            : null,
        }
      : { latest_exam: null, best_exam: null, weakest_exam: null },
    insights: Array.isArray(data.insights) ? data.insights.map(richHtmlToPlainText) : [],
  };
}
