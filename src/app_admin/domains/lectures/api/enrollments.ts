// PATH: src/app_admin/domains/lectures/api/enrollments.ts
// Compatibility facade. The canonical enrollment API lives in app_admin/domains/enrollment.
export type {
  ExcelEnrollJobStatus,
  LectureEnrollmentRow,
  LectureEnrollmentStudent,
  SessionEnrollmentRow,
} from "@admin/domains/enrollment/api/enrollments";

export {
  bulkCreateEnrollments,
  bulkCreateSessionEnrollments,
  fetchLectureEnrollments,
  fetchSessionEnrollments,
  getExcelEnrollJobStatus,
  lectureEnrollFromExcelUpload,
} from "@admin/domains/enrollment/api/enrollments";
