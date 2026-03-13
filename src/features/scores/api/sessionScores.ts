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

  /** 프로필 사진 URL (API 확장 시 제공) */
  profile_photo_url?: string | null;
  /** 강의명 (API 확장 시 제공) */
  lecture_title?: string | null;
  /** 강의 색상 (API 확장 시 제공) */
  lecture_color?: string | null;

  // 시험 1:N
  exams: SessionScoreExamEntry[];

  // 과제 1:N
  homeworks: SessionScoreHomeworkEntry[];

  updated_at: string;

  /** 행 단위 클리닉 대상 여부(백엔드 ClinicLink). 판정 컬럼 "대상"|"합격" 표시용 */
  clinic_required?: boolean;
  /** 클리닉 대상 + 해당 주차 클리닉 미수강 → 이름만 노란 형광펜. 수강 완료(ATTENDED) 시 false.
   * 세션 성적 API에서 제공. 다른 세션 단위 학생 목록 API(출결/등록 등)에서도 동일 필드 제공 시
   * StudentNameWithLectureChip에 clinicHighlight로 넘기면 전역 동일 스타일 적용 가능. */
  name_highlight_clinic_target?: boolean;
};

export type SessionScoreMeta = {
  exams: {
    exam_id: number;
    title: string;
    pass_score: number;
    max_score: number;
    display_order: number;
    /** 주관식 점수 입력 모드용 문항 목록 */
    questions?: { question_id: number; number: number; max_score: number }[];
  }[];

  homeworks: {
    homework_id: number;
    title: string;
    unit: string | null; // "%", "점" 등 (서버 단일 진실)
    max_score: number;
    display_order: number;
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
