// PATH: src/features/scores/api/sessionScores.ts
/**
 * Session Scores API (ADMIN)
 * - 서버가 계산/판정/클리닉 단일 진실
 * - 프론트는 표시 + 입력 + invalidate만 수행
 *
 * ✅ DTO 핵심:
 * - rows[n].exams = 시험 1:N 배열
 * - rows[n].homeworks = 과제 1:N 배열
 */

import api from "@/shared/api/axios";

export type ScoreBlock = {
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
  clinic_required: boolean;

  is_locked?: boolean;
  lock_reason?: string | null;

  /** 시험만: 객관식 점수 (합산 = score = objective + subjective) */
  objective_score?: number | null;
  /** 시험만: 주관식 점수 = sum(ResultItem) */
  subjective_score?: number | null;

  meta?: {
    status?: string | null;
  } | null;
};

export type SessionScoreExamEntry = {
  exam_id: number;
  title: string;
  pass_score: number;
  block: ScoreBlock;
  /** 주관식 점수 입력 모드용 문항별 점수 (서버가 내려줌) */
  items?: { question_id: number; score: number; max_score: number }[];
};

export type SessionScoreHomeworkEntry = {
  homework_id: number;
  title: string;
  block: ScoreBlock;
};

export type SessionScoreRow = {
  enrollment_id: number;
  student_id?: number | null;
  student_name: string;

  // 시험 1:N
  exams: SessionScoreExamEntry[];

  // 과제 1:N
  homeworks: SessionScoreHomeworkEntry[];

  updated_at: string;

  /** 클리닉 대상이면서 클리닉 예약 없음 → 이름 셀 노란 배경 */
  name_highlight_clinic_no_reservation?: boolean;
};

export type SessionScoreMeta = {
  exams: {
    exam_id: number;
    title: string;
    pass_score: number;
    /** 주관식 점수 입력 모드용 문항 목록 */
    questions?: { question_id: number; number: number; max_score: number }[];
  }[];

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
