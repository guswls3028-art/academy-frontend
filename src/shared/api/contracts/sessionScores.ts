import api from "@/shared/api/axios";
import type { Achievement } from "@/shared/scoring/achievement";

export type ScoreBlock = {
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
  clinic_required: boolean;
  is_locked?: boolean;
  lock_reason?: string | null;
  objective_score?: number | null;
  subjective_score?: number | null;
  remediated?: boolean | null;
  final_pass?: boolean | null;
  achievement?: Achievement | null;
  is_provisional?: boolean;
  meta?: {
    status?: string | null;
    manual_review_required?: boolean;
    manual_review_reasons?: string[];
    submission_id?: number;
  } | null;
};

export type ScoreAttemptEntry = {
  attempt_index: number;
  score: number | null;
  max_score?: number | null;
  pass_score?: number | null;
  passed: boolean | null;
  at?: string | null;
  source?: "grade" | "clinic";
  meta_status?: string | null;
};

export type SessionScoreExamEntry = {
  exam_id: number;
  title: string;
  pass_score: number;
  block: ScoreBlock;
  items?: { question_id: number; score: number; max_score: number }[];
  attempt_count?: number;
  clinic_link_id?: number | null;
  attempts?: ScoreAttemptEntry[];
};

export type SessionScoreHomeworkEntry = {
  homework_id: number;
  title: string;
  block: ScoreBlock;
  attempt_count?: number;
  clinic_link_id?: number | null;
};

export type SessionScoreRow = {
  enrollment_id: number;
  student_id?: number | null;
  student_name: string;
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  exams: SessionScoreExamEntry[];
  homeworks: SessionScoreHomeworkEntry[];
  updated_at: string;
  clinic_required?: boolean;
  progress_completed?: boolean;
  progress_status?: "completed" | "in_progress";
  name_highlight_clinic_target?: boolean;
};

export type SessionScoreMeta = {
  session_title?: string;
  lecture_title?: string;
  lecture_id?: number | null;
  exams: {
    exam_id: number;
    title: string;
    pass_score: number;
    max_score: number;
    display_order: number;
    questions?: { question_id: number; number: number; max_score: number }[];
  }[];
  homeworks: {
    homework_id: number;
    title: string;
    unit: string | null;
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
