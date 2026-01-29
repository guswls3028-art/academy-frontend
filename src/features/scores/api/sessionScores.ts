// PATH: src/features/scores/api/sessionScores.ts
/**
 * Session Scores API (ADMIN)
 * - 서버가 계산/판정/클리닉 단일 진실
 * - 프론트는 표시 + 입력 + invalidate만 수행
 *
 * ✅ DTO 핵심:
 * - rows[n].exams = 시험 1:N 배열
 * - (변경) rows[n].homeworks = 과제 1:N 배열
 */

import api from "@/shared/api/axios";

export type ScoreBlock = {
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
  clinic_required: boolean;

  is_locked?: boolean;
  lock_reason?: string | null;
};

export type SessionScoreExamEntry = {
  exam_id: number;
  title: string;
  pass_score: number;
  block: ScoreBlock;
};

export type SessionScoreHomeworkEntry = {
  homework_id: number;
  title: string;
  block: ScoreBlock;
};

export type SessionScoreRow = {
  enrollment_id: number;
  student_name: string;

  // 시험 1:N
  exams: SessionScoreExamEntry[];

  // ✅ 과제 1:N
  homeworks: SessionScoreHomeworkEntry[];

  updated_at: string;
};

export type SessionScoreMeta = {
  exams: {
    exam_id: number;
    title: string;
    pass_score: number;
  }[];

  // ✅ 과제 1:N
  homeworks: {
    homework_id: number;
    title: string;
    unit: string | null; // "%", "점" 등 (서버 단일 진실)
  }[];
};

export type SessionScoresResponse = {
  meta: SessionScoreMeta;
  rows: SessionScoreRow[];
};

export async function fetchSessionScores(sessionId: number) {
  const res = await api.get(`/results/admin/sessions/${sessionId}/scores/`);
  return res.data as SessionScoresResponse;
}
