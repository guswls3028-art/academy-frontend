// PATH: src/app_admin/domains/exams/queryKeys.ts

import { submissionsQueryKeys } from "@/shared/api/queryKeys/submissions";

export const adminExamsQueryKeys = {
  adminExamsLectures: ["admin-exams-lectures"] as const,
  lectureSessionsAll: ["lecture-sessions-all"] as const,
  adminExamsForSession: (sessionId: number | null | undefined) => ["admin-exams", sessionId] as const,

  examDetail: (examId: number | null | undefined) => ["exam-detail", examId] as const,
  adminExam: (examId: number | null | undefined) => ["admin-exam", examId] as const,
  examAssets: (examId: number | null | undefined) => ["exam-assets", examId] as const,
  examEnrollment: (examId: number | undefined, sessionId: number | undefined) =>
    ["exam-enrollment", examId, sessionId] as const,
  examLectureAssignments: (examId: number | null | undefined) =>
    ["exam-lecture-assignments", examId] as const,
  examAssignmentLectures: () => ["exam-assignment-lectures"] as const,
  examAssignmentSessions: (lectureId: number | null) =>
    ["exam-assignment-sessions", lectureId] as const,
  examEnrollmentRoot: (examId: number) => ["exam-enrollment", examId] as const,

  adminExamSummary: (examId: number) => ["admin-exam-summary", examId] as const,
  adminExamResultsRoot: (examId: number) => ["admin-exam-results", examId] as const,
  adminExamDetailRoot: (examId: number) => ["admin-exam-detail", examId] as const,
  sessionScoresRoot: () => ["session-scores"] as const,
  clinicTargetsRoot: () => ["clinic-targets"] as const,
  adminExamResults: (examId: number, lectureId?: number | null) =>
    ["admin-exam-results", examId, lectureId ?? "all"] as const,
  examQuestionStats: (examId: number, lectureId?: number | null) =>
    ["exam-question-stats", examId, lectureId ?? "all"] as const,
  examSubmissions: (examId: number) => ["exam-submissions", examId] as const,

  examQuestions: (examId: number | null | undefined) => ["exam-questions", examId] as const,
  answerKey: (examId: number | null | undefined) => ["answer-key", examId] as const,
  examExplanations: (examId: number | null | undefined) => ["exam-explanations", examId] as const,

  templateBundles: ["template-bundles"] as const,
  templatesWithUsage: ["templates-with-usage"] as const,
  lecturesForOmr: ["lectures-for-omr"] as const,
  sessionsForOmr: (lectureId: number) => ["sessions-for-omr", lectureId] as const,

  adminSubmissions: submissionsQueryKeys.adminSubmissions,
  adminPendingSubmissions: submissionsQueryKeys.adminPending,
};
