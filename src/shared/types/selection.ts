/**
 * Discriminated union for modal/selector selection results.
 * Prevents ID domain confusion by making the entity type explicit at the type level.
 *
 * FORBIDDEN: { ids: number[] } where the meaning of ids varies by context
 * REQUIRED: Use one of these tagged variants instead
 */

/** Selection of enrollment IDs (e.g., from clinic targets) */
export type EnrollmentSelection = {
  readonly kind: "enrollment";
  readonly enrollmentIds: readonly number[];
};

/** Selection of student IDs (e.g., from student search) */
export type StudentSelection = {
  readonly kind: "student";
  readonly studentIds: readonly number[];
};

/** Selection of exam IDs */
export type ExamSelection = {
  readonly kind: "exam";
  readonly examIds: readonly number[];
};

/** Selection of homework IDs */
export type HomeworkSelection = {
  readonly kind: "homework";
  readonly homeworkIds: readonly number[];
};

/** Selection of staff IDs */
export type StaffSelection = {
  readonly kind: "staff";
  readonly staffIds: readonly number[];
};

/** Selection of attendance record IDs */
export type AttendanceSelection = {
  readonly kind: "attendance";
  readonly attendanceIds: readonly number[];
};

/** Union of all possible selection types */
export type SelectionResult =
  | EnrollmentSelection
  | StudentSelection
  | ExamSelection
  | HomeworkSelection
  | StaffSelection
  | AttendanceSelection;

// ── Helpers ──

export function enrollmentSelection(ids: number[]): EnrollmentSelection {
  return { kind: "enrollment", enrollmentIds: ids };
}

export function studentSelection(ids: number[]): StudentSelection {
  return { kind: "student", studentIds: ids };
}
