// PATH: src/features/sessions/components/enrollment/types.ts

/**
 * EnrollmentRow
 *
 * 공용 Enrollment UI에서 사용하는 최소 단위
 * - server concept(is_selected) 사용 ❌
 * - 선택 상태는 selectedIds(Set)로만 관리
 */
export type EnrollmentRow = {
  enrollment_id: number;
  student_name: string;
};
