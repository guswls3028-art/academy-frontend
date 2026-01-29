/**
 * PATH: src/features/results/types/editState.ts
 *
 * ✅ EditState (Phase 4 - A1)
 *
 * 설계 원칙:
 * - backend 응답과 1:1 계약
 * - optional ❌
 * - 누락 = 시스템 오류
 */

export type EditState = {
  can_edit: boolean;
  is_locked: boolean;
  lock_reason: string | null;

  last_updated_by: {
    id: number;
    name: string;
  } | null;

  updated_at: string | null;
};
