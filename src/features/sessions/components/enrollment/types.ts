// PATH: src/features/sessions/components/enrollment/types.ts

/**
 * EnrollmentRow
 *
 * 공용 Enrollment UI에서 사용하는 최소 단위
 * - server concept(is_selected) 사용 ❌
 * - 선택 상태는 selectedIds(Set)로만 관리
 *
 * 차시 수강생 등록 모달과 동일한 좌측 테이블(아바타·강의 딱지) 표시를 위한 선택 필드:
 * - profile_photo_url, lectures 가 있으면 StudentNameWithLectureChip 사용
 */
export type EnrollmentRowLecture = {
  lectureName: string;
  color?: string | null;
  chipLabel?: string | null;
};

export type EnrollmentRow = {
  enrollment_id: number;
  student_name: string;
  /** 아바타 표시용 (있으면 StudentNameWithLectureChip에 전달) */
  profile_photo_url?: string | null;
  /** 강의 딱지 표시용 (1개: 해당 수강 강의, 있으면 StudentNameWithLectureChip에 전달) */
  lectures?: EnrollmentRowLecture[] | null;
  /** 학생 상세 — 대상자 관리 테이블 표시용 */
  parent_phone?: string | null;
  student_phone?: string | null;
  school?: string | null;
  grade?: number | null;
};
