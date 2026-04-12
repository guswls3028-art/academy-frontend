// PATH: src/app_admin/domains/homework/types.ts
/**
 * HomeworkPolicy (Session 단위 정책)
 *
 * ✅ LOCKED
 * - 프론트는 "설정 입력"만 한다
 * - passed/clinic 판단은 서버 단일 진실
 *
 * ✅ 추가 요구사항
 * - 커트라인 입력 모드 선택 (% or 문항수)
 * - 반올림 단위는 유지
 * - 클리닉 옵션은 UI에서 제거 (자동 제공)
 */

export type HomeworkCutlineMode = "PERCENT" | "COUNT";

/** 시험 ExamTabKey와 동일한 구조: design 시 4탭, operate 시 setup | results */
export type HomeworkTabKey = "setup" | "assets" | "submissions" | "results";

export type HomeworkSummary = {
  id: number;
  title: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  session_id?: number;
  homework_type?: "template" | "regular";
  template_homework_id?: number | null;
};

export type HomeworkScore = {
  id: number;
  enrollment_id: number;
  session: number;
  score: number | null;
  max_score: number | null;
  teacher_approved: boolean;
  passed: boolean | null;
  clinic_required: boolean;
  is_locked: boolean;
  lock_reason: string | null;
  updated_by_user_id: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type SessionEnrollment = {
  id: number;
  session: number;
  enrollment: number;
  student_name: string;
  created_at: string;
};

export type HomeworkPolicy = {
  id: number;
  session: number;

  cutline_mode: HomeworkCutlineMode; // "PERCENT" | "COUNT"
  cutline_value: number; // 70 or 40

  round_unit_percent: number; // percent 모드에서만 실질 의미 (예: 5)

  created_at: string;
  updated_at: string;
};
